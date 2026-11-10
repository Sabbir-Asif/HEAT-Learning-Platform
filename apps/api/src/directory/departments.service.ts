import { Inject, Injectable } from "@nestjs/common";
import type {
  CreateDepartmentRequest,
  DepartmentListQuery,
  DepartmentListResponse,
  DepartmentSummary,
  UpdateDepartmentRequest,
} from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { AuditService } from "../audit";
import { DATABASE } from "../core";
import { ApiException } from "../http/api-exception";
import {
  deleteBlockingMessage,
  moveBlockedMessage,
  studentCountOf,
  studentCountsOf,
} from "./department-usage";
import { DirectoryCache } from "./directory-cache";
import {
  archivedError,
  errorCodeOf,
  lockParents,
  statusWhere,
  translateDirectoryError,
} from "./directory-rules";

interface DepartmentRow {
  id: string;
  name: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  universityFaculty: {
    university: { id: string; name: string; archivedAt: Date | null };
    faculty: { id: string; name: string; archivedAt: Date | null };
  };
}

interface Pair {
  universityId: string;
  facultyId: string;
}

const withPair = {
  universityFaculty: {
    select: {
      university: { select: { id: true, name: true, archivedAt: true } },
      faculty: { select: { id: true, name: true, archivedAt: true } },
    },
  },
};

const orderBy = (sort: DepartmentListQuery["sort"]) => {
  switch (sort) {
    case "-name":
      return { name: "desc" as const };
    case "createdAt":
      return { createdAt: "asc" as const };
    case "-createdAt":
      return { createdAt: "desc" as const };
    default:
      return { name: "asc" as const };
  }
};

const toSummary = (row: DepartmentRow, studentCount: number): DepartmentSummary => ({
  id: row.id,
  name: row.name,
  university: {
    id: row.universityFaculty.university.id,
    name: row.universityFaculty.university.name,
  },
  faculty: { id: row.universityFaculty.faculty.id, name: row.universityFaculty.faculty.name },
  archivedAt: row.archivedAt?.toISOString() ?? null,
  parentArchived:
    row.universityFaculty.university.archivedAt !== null ||
    row.universityFaculty.faculty.archivedAt !== null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  studentCount,
});

const notOfferedError = (): ApiException =>
  new ApiException(
    400,
    "VALIDATION_FAILED",
    undefined,
    "This faculty is not offered at the chosen university.",
  );

const snapshot = (row: DepartmentRow) => ({
  name: row.name,
  universityId: row.universityFaculty.university.id,
  universityName: row.universityFaculty.university.name,
  facultyId: row.universityFaculty.faculty.id,
  facultyName: row.universityFaculty.faculty.name,
});

@Injectable()
export class DepartmentsService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly audit: AuditService,
    private readonly cache: DirectoryCache,
  ) {}

  async list(query: DepartmentListQuery): Promise<DepartmentListResponse> {
    const where = {
      ...statusWhere(query.status),
      ...(query.q === undefined
        ? {}
        : { name: { contains: query.q, mode: "insensitive" as const } }),
      ...(query.universityId === undefined ? {} : { universityId: query.universityId }),
      ...(query.facultyId === undefined ? {} : { facultyId: query.facultyId }),
    };
    const [rows, total] = await Promise.all([
      this.database.department.findMany({
        where,
        orderBy: [orderBy(query.sort), { id: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: withPair,
      }),
      this.database.department.count({ where }),
    ]);
    const counts = await studentCountsOf(
      this.database,
      rows.map((row) => row.id),
    );
    const items = rows.map((row) => toSummary(row, counts.get(row.id) ?? 0));
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async get(id: string): Promise<DepartmentSummary> {
    const row = await this.existing(id, this.database);
    return toSummary(row, await studentCountOf(this.database, id));
  }

  async create(request: CreateDepartmentRequest): Promise<DepartmentSummary> {
    const client = this.audit.client(this.database);
    await lockParents(client, request.universityId, request.facultyId);
    await this.assertPairLinked(request, client);
    await this.assertNameFree(request.name, request);
    try {
      const created = await client.department.create({
        data: {
          name: request.name,
          universityId: request.universityId,
          facultyId: request.facultyId,
        },
        include: withPair,
      });
      this.invalidateAfterCommit();
      this.audit.capture({ entityId: created.id, after: snapshot(created) });
      return toSummary(created, 0);
    } catch (error) {
      throw errorCodeOf(error) === "P2003" ? notOfferedError() : translateDirectoryError(error);
    }
  }

  async update(id: string, request: UpdateDepartmentRequest): Promise<DepartmentSummary> {
    const before = await this.existing(id, this.database);
    const moved =
      before.universityFaculty.university.id !== request.universityId ||
      before.universityFaculty.faculty.id !== request.facultyId;
    const client = this.audit.client(this.database);
    if (moved) {
      await lockParents(client, request.universityId, request.facultyId);
      await this.assertPairLinked(request, client);
    }
    await this.assertNameFree(request.name, request, id);
    try {
      const data = {
        name: request.name,
        universityId: request.universityId,
        facultyId: request.facultyId,
      };
      if (moved) {
        const { count } = await client.department.updateMany({
          where: { id, profiles: { none: {} } },
          data,
        });
        if (count === 0) await this.refuseMove(id, before.name);
      } else {
        await client.department.update({ where: { id }, data });
      }
      const updated = await this.existing(id, client);
      this.invalidateAfterCommit();
      this.audit.capture({
        entityId: id,
        before: snapshot(before),
        after: snapshot(updated),
      });
      return toSummary(updated, await studentCountOf(this.database, id));
    } catch (error) {
      throw this.translateUpdateError(error);
    }
  }

  async remove(id: string): Promise<void> {
    const before = await this.existing(id, this.database);
    const blocked = deleteBlockingMessage(await studentCountOf(this.database, id));
    if (blocked !== null) throw new ApiException(409, "DIRECTORY_IN_USE", undefined, blocked);
    try {
      await this.audit.client(this.database).department.delete({ where: { id } });
    } catch (error) {
      if (errorCodeOf(error) === "P2003") {
        const message = deleteBlockingMessage(await studentCountOf(this.database, id));
        throw new ApiException(409, "DIRECTORY_IN_USE", undefined, message ?? undefined);
      }
      throw translateDirectoryError(error);
    }
    this.invalidateAfterCommit();
    this.audit.capture({ entityId: id, before: snapshot(before) });
  }

  archive(id: string): Promise<DepartmentSummary> {
    return this.setArchived(id, true);
  }

  restore(id: string): Promise<DepartmentSummary> {
    return this.setArchived(id, false);
  }

  private async setArchived(id: string, archive: boolean): Promise<DepartmentSummary> {
    const client = this.audit.client(this.database);
    const { count } = await client.department.updateMany({
      where: { id, archivedAt: archive ? null : { not: null } },
      data: { archivedAt: archive ? new Date() : null },
    });
    const row = await this.existing(id, client);
    if (count === 0) {
      this.audit.skip();
    } else {
      this.invalidateAfterCommit();
      this.audit.capture({
        entityId: id,
        before: { ...snapshot(row), archived: !archive },
        after: { ...snapshot(row), archived: archive },
      });
    }
    return toSummary(row, await studentCountOf(this.database, id));
  }

  private async refuseMove(id: string, name: string): Promise<never> {
    const students = await studentCountOf(this.database, id);
    if (students === 0) throw new ApiException(404, "NOT_FOUND");
    throw new ApiException(409, "DIRECTORY_IN_USE", undefined, moveBlockedMessage(name, students));
  }

  private translateUpdateError(error: unknown): unknown {
    if (errorCodeOf(error) === "P2003") return new ApiException(404, "NOT_FOUND");
    return translateDirectoryError(error);
  }

  private invalidateAfterCommit(): void {
    this.audit.afterCommit(() => this.cache.invalidate());
  }

  private async existing(
    id: string,
    client: Pick<HeatClient, "department">,
  ): Promise<DepartmentRow> {
    const row = await client.department.findUnique({ where: { id }, include: withPair });
    if (row === null) throw new ApiException(404, "NOT_FOUND");
    return row;
  }

  private async assertPairLinked(
    pair: Pair,
    client: Pick<HeatClient, "universityFaculty">,
  ): Promise<void> {
    const link = await client.universityFaculty.findUnique({
      where: {
        universityId_facultyId: { universityId: pair.universityId, facultyId: pair.facultyId },
      },
      select: {
        university: { select: { archivedAt: true } },
        faculty: { select: { archivedAt: true } },
      },
    });
    if (link === null) throw notOfferedError();
    if (link.university.archivedAt !== null || link.faculty.archivedAt !== null) {
      throw archivedError();
    }
  }

  private async assertNameFree(name: string, pair: Pair, excludeId?: string): Promise<void> {
    const taken = await this.database.department.findFirst({
      where: {
        ...(excludeId === undefined ? {} : { id: { not: excludeId } }),
        universityId: pair.universityId,
        facultyId: pair.facultyId,
        name: { equals: name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (taken !== null) throw new ApiException(409, "DIRECTORY_NAME_TAKEN");
  }
}

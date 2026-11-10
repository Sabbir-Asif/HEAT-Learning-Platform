import { Inject, Injectable } from "@nestjs/common";
import type {
  CreateFacultyRequest,
  FacultyListQuery,
  FacultyListResponse,
  FacultySummary,
  UpdateFacultyRequest,
} from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { AuditService } from "../audit";
import { DATABASE } from "../core";
import { ApiException } from "../http/api-exception";
import { DirectoryCache } from "./directory-cache";
import {
  archiveChange,
  archivedError,
  errorCodeOf,
  statusWhere,
  translateDirectoryError,
} from "./directory-rules";
import {
  blockingMessage,
  departmentUsageOf,
  unassignBlockedMessage,
  usageOf,
} from "./faculty-usage";
import type { FacultyUsage } from "./faculty-usage";

interface FacultyRow {
  id: string;
  name: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  universities: Array<{ university: { id: string; name: string } }>;
}

const withUniversities = {
  universities: {
    select: { university: { select: { id: true, name: true } } },
    orderBy: { university: { name: "asc" as const } },
  },
};

const orderBy = (sort: FacultyListQuery["sort"]) => {
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

const toSummary = (
  row: FacultyRow,
  usage: Pick<FacultyUsage, "students" | "departments">,
): FacultySummary => ({
  id: row.id,
  name: row.name,
  archivedAt: row.archivedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  studentCount: usage.students,
  departmentCount: usage.departments,
  universities: row.universities.map((link) => link.university),
});

@Injectable()
export class FacultiesService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly audit: AuditService,
    private readonly cache: DirectoryCache,
  ) {}

  async list(query: FacultyListQuery): Promise<FacultyListResponse> {
    const where = {
      ...statusWhere(query.status),
      ...(query.q === undefined
        ? {}
        : { name: { contains: query.q, mode: "insensitive" as const } }),
      ...(query.universityId === undefined
        ? {}
        : { universities: { some: { universityId: query.universityId } } }),
    };
    const [rows, total] = await Promise.all([
      this.database.faculty.findMany({
        where,
        orderBy: [orderBy(query.sort), { id: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: withUniversities,
      }),
      this.database.faculty.count({ where }),
    ]);
    const usage = await departmentUsageOf(
      this.database,
      rows.map((row) => row.id),
    );
    const items = rows.map((row) =>
      toSummary(row, {
        students: usage.get(row.id)?.students ?? 0,
        departments: usage.get(row.id)?.departments ?? 0,
      }),
    );
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async get(id: string): Promise<FacultySummary> {
    return this.summaryOf(id, this.database);
  }

  async create(request: CreateFacultyRequest): Promise<FacultySummary> {
    await this.assertNameFree(request.name);
    try {
      const created = await this.audit
        .client(this.database)
        .faculty.create({ data: { name: request.name }, include: withUniversities });
      this.invalidateAfterCommit();
      this.audit.capture({ entityId: created.id, after: { name: created.name } });
      return toSummary(created, { students: 0, departments: 0 });
    } catch (error) {
      throw translateDirectoryError(error);
    }
  }

  async update(id: string, request: UpdateFacultyRequest): Promise<FacultySummary> {
    const before = await this.existing(id, this.database);
    await this.assertNameFree(request.name, id);
    try {
      const updated = await this.audit
        .client(this.database)
        .faculty.update({ where: { id }, data: { name: request.name }, include: withUniversities });
      this.invalidateAfterCommit();
      this.audit.capture({
        entityId: id,
        before: { name: before.name },
        after: { name: updated.name },
      });
      return toSummary(updated, await usageOf(this.database, id));
    } catch (error) {
      throw translateDirectoryError(error);
    }
  }

  async remove(id: string): Promise<void> {
    const before = await this.existing(id, this.database);
    const blocked = blockingMessage(await usageOf(this.database, id));
    if (blocked !== null) throw new ApiException(409, "DIRECTORY_IN_USE", undefined, blocked);
    try {
      await this.audit.client(this.database).faculty.delete({ where: { id } });
    } catch (error) {
      if (errorCodeOf(error) === "P2003") {
        const message = blockingMessage(await usageOf(this.database, id));
        throw new ApiException(409, "DIRECTORY_IN_USE", undefined, message ?? undefined);
      }
      throw translateDirectoryError(error);
    }
    this.invalidateAfterCommit();
    this.audit.capture({ entityId: id, before: { name: before.name } });
  }

  async assign(id: string, universityId: string): Promise<FacultySummary> {
    const client = this.audit.client(this.database);
    const faculty = await this.existing(id, client);
    const university = await client.university.findUnique({
      where: { id: universityId },
      select: { id: true, name: true, archivedAt: true },
    });
    if (university === null) throw new ApiException(404, "NOT_FOUND");
    if (faculty.archivedAt !== null || university.archivedAt !== null) throw archivedError();
    const link = { universityId, universityName: university.name };
    const created = await client.universityFaculty
      .createMany({ data: [{ universityId, facultyId: id }], skipDuplicates: true })
      .catch((error: unknown) => {
        throw errorCodeOf(error) === "P2003" ? new ApiException(404, "NOT_FOUND") : error;
      });
    await this.assertStillActive(id, universityId, client);
    this.invalidateAfterCommit();
    this.audit.capture(
      created.count > 0
        ? { entityId: id, after: link }
        : { entityId: id, before: link, after: link },
    );
    return this.summaryOf(id, client);
  }

  async unassign(id: string, universityId: string): Promise<FacultySummary> {
    const client = this.audit.client(this.database);
    const faculty = await this.existing(id, client);
    const pair = { universityId_facultyId: { universityId, facultyId: id } };
    const link = await client.universityFaculty.findUnique({
      where: pair,
      select: { university: { select: { id: true, name: true } } },
    });
    if (link === null) throw new ApiException(404, "NOT_FOUND");
    const universityName = link.university.name;
    const departments = await client.department.findMany({
      where: { universityId, facultyId: id },
      select: { name: true },
      orderBy: { name: "asc" },
    });
    const blocked = (names: readonly string[]) =>
      new ApiException(
        409,
        "DIRECTORY_IN_USE",
        undefined,
        unassignBlockedMessage(faculty.name, universityName, names),
      );
    if (departments.length > 0) throw blocked(departments.map((department) => department.name));
    try {
      await client.universityFaculty.delete({ where: pair });
    } catch (error) {
      if (errorCodeOf(error) === "P2003") {
        const names = await this.database.department.findMany({
          where: { universityId, facultyId: id },
          select: { name: true },
          orderBy: { name: "asc" },
        });
        throw blocked(names.map((department) => department.name));
      }
      throw translateDirectoryError(error);
    }
    this.invalidateAfterCommit();
    this.audit.capture({ entityId: id, before: { universityId, universityName } });
    return this.summaryOf(id, client);
  }

  archive(id: string): Promise<FacultySummary> {
    return this.setArchived(id, true);
  }

  restore(id: string): Promise<FacultySummary> {
    return this.setArchived(id, false);
  }

  private async setArchived(id: string, archive: boolean): Promise<FacultySummary> {
    const client = this.audit.client(this.database);
    const { count } = await client.faculty.updateMany({
      where: { id, archivedAt: archive ? null : { not: null } },
      data: { archivedAt: archive ? new Date() : null },
    });
    const row = await this.existing(id, client);
    this.invalidateAfterCommit();
    this.audit.capture(archiveChange(row, archive, count > 0));
    return toSummary(row, await usageOf(this.database, id));
  }

  private async assertStillActive(
    id: string,
    universityId: string,
    client: Pick<HeatClient, "faculty" | "university">,
  ): Promise<void> {
    const [faculty, university] = await Promise.all([
      client.faculty.findUnique({ where: { id }, select: { archivedAt: true } }),
      client.university.findUnique({ where: { id: universityId }, select: { archivedAt: true } }),
    ]);
    if (faculty === null || university === null) throw new ApiException(404, "NOT_FOUND");
    if (faculty.archivedAt !== null || university.archivedAt !== null) throw archivedError();
  }

  private async summaryOf(
    id: string,
    client: Pick<HeatClient, "faculty">,
  ): Promise<FacultySummary> {
    const row = await this.existing(id, client);
    return toSummary(row, await usageOf(this.database, id));
  }

  private invalidateAfterCommit(): void {
    this.audit.afterCommit(() => this.cache.invalidate());
  }

  private async existing(id: string, client: Pick<HeatClient, "faculty">): Promise<FacultyRow> {
    const row = await client.faculty.findUnique({ where: { id }, include: withUniversities });
    if (row === null) throw new ApiException(404, "NOT_FOUND");
    return row;
  }

  private async assertNameFree(name: string, excludeId?: string): Promise<void> {
    const taken = await this.database.faculty.findFirst({
      where: {
        ...(excludeId === undefined ? {} : { id: { not: excludeId } }),
        name: { equals: name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (taken !== null) throw new ApiException(409, "DIRECTORY_NAME_TAKEN");
  }
}

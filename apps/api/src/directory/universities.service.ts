import { Inject, Injectable } from "@nestjs/common";
import type {
  CreateUniversityRequest,
  UniversityListQuery,
  UniversityListResponse,
  UniversitySummary,
  UpdateUniversityRequest,
} from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { AuditService } from "../audit";
import { DATABASE } from "../core";
import { ApiException } from "../http/api-exception";
import { blockingMessage, departmentUsageOf, usageOf } from "./university-usage";
import type { UniversityUsage } from "./university-usage";

interface UniversityRow {
  id: string;
  name: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const orderBy = (sort: UniversityListQuery["sort"]) => {
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

const errorCodeOf = (error: unknown): unknown =>
  typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;

const toSummary = (row: UniversityRow, usage: UniversityUsage): UniversitySummary => ({
  id: row.id,
  name: row.name,
  archivedAt: row.archivedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  studentCount: usage.students,
  departmentCount: usage.departments,
  facultyCount: usage.faculties,
});

@Injectable()
export class UniversitiesService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly audit: AuditService,
  ) {}

  async list(query: UniversityListQuery): Promise<UniversityListResponse> {
    const where =
      query.q === undefined ? {} : { name: { contains: query.q, mode: "insensitive" as const } };
    const [rows, total] = await Promise.all([
      this.database.university.findMany({
        where,
        orderBy: [orderBy(query.sort), { id: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { _count: { select: { faculties: true } } },
      }),
      this.database.university.count({ where }),
    ]);
    const usage = await departmentUsageOf(
      this.database,
      rows.map((row) => row.id),
    );
    const items = rows.map((row) =>
      toSummary(row, {
        students: usage.get(row.id)?.students ?? 0,
        departments: usage.get(row.id)?.departments ?? 0,
        faculties: row._count.faculties,
      }),
    );
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async get(id: string): Promise<UniversitySummary> {
    const row = await this.existing(id);
    return toSummary(row, await usageOf(this.database, id));
  }

  async create(request: CreateUniversityRequest): Promise<UniversitySummary> {
    await this.assertNameFree(request.name);
    try {
      const created = await this.audit
        .client(this.database)
        .university.create({ data: { name: request.name } });
      this.audit.capture({ entityId: created.id, after: { name: created.name } });
      return toSummary(created, { students: 0, departments: 0, faculties: 0 });
    } catch (error) {
      throw this.translate(error);
    }
  }

  async update(id: string, request: UpdateUniversityRequest): Promise<UniversitySummary> {
    const before = await this.existing(id);
    await this.assertNameFree(request.name, id);
    try {
      const updated = await this.audit
        .client(this.database)
        .university.update({ where: { id }, data: { name: request.name } });
      this.audit.capture({
        entityId: id,
        before: { name: before.name },
        after: { name: updated.name },
      });
      return toSummary(updated, await usageOf(this.database, id));
    } catch (error) {
      throw this.translate(error);
    }
  }

  async remove(id: string): Promise<void> {
    const before = await this.existing(id);
    const blocked = blockingMessage(await usageOf(this.database, id));
    if (blocked !== null) throw new ApiException(409, "DIRECTORY_IN_USE", undefined, blocked);
    try {
      await this.audit.client(this.database).university.delete({ where: { id } });
    } catch (error) {
      if (errorCodeOf(error) === "P2003") {
        const message = blockingMessage(await usageOf(this.database, id));
        throw new ApiException(409, "DIRECTORY_IN_USE", undefined, message ?? undefined);
      }
      throw this.translate(error);
    }
    this.audit.capture({ entityId: id, before: { name: before.name } });
  }

  private async existing(id: string): Promise<UniversityRow> {
    const row = await this.database.university.findUnique({ where: { id } });
    if (row === null) throw new ApiException(404, "NOT_FOUND");
    return row;
  }

  private async assertNameFree(name: string, excludeId?: string): Promise<void> {
    const taken = await this.database.university.findFirst({
      where: {
        ...(excludeId === undefined ? {} : { id: { not: excludeId } }),
        name: { equals: name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (taken !== null) throw new ApiException(409, "DIRECTORY_NAME_TAKEN");
  }

  private translate(error: unknown): unknown {
    if (error instanceof ApiException) return error;
    if (errorCodeOf(error) === "P2002") return new ApiException(409, "DIRECTORY_NAME_TAKEN");
    if (errorCodeOf(error) === "P2025") return new ApiException(404, "NOT_FOUND");
    return error;
  }
}

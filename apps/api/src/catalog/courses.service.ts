import { Inject, Injectable } from "@nestjs/common";
import type {
  CourseListQuery,
  CourseListResponse,
  CourseStatus,
  CourseSummary,
  CreateCourseRequest,
  UpdateCourseRequest,
} from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { AuditService } from "../audit";
import { DATABASE } from "../core";
import { ApiException } from "../http/api-exception";
import {
  assertCanDelete,
  assertCanPublish,
  assertLockedEditAllowed,
  publishChecksFailed,
} from "./course-rules";
import { COURSE_PUBLISH_CHECKS } from "./publish-checks";
import { courseCacheTag, frontPageCacheTag, PUBLIC_REVALIDATION } from "./public-revalidation";
import type { PublicRevalidation } from "./public-revalidation";
import type { CoursePublishCheck } from "./publish-checks";

interface CourseRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnailAssetId: string | null;
  status: CourseStatus;
  lockedAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { enrollments: number };
  revisions: Array<{ id: string; number: number; publishedAt: Date | null }>;
}

const withSummaryParts = {
  _count: { select: { enrollments: true } },
  revisions: {
    select: { id: true, number: true, publishedAt: true },
    orderBy: { number: "desc" as const },
    take: 1,
  },
};

const orderBy = (sort: CourseListQuery["sort"]) => {
  switch (sort) {
    case "-title":
      return { title: "desc" as const };
    case "createdAt":
      return { createdAt: "asc" as const };
    case "-createdAt":
      return { createdAt: "desc" as const };
    case "updatedAt":
      return { updatedAt: "asc" as const };
    case "-updatedAt":
      return { updatedAt: "desc" as const };
    default:
      return { title: "asc" as const };
  }
};

const statusWhere = (status: CourseListQuery["status"]) => {
  if (status === "draft") return { status: "DRAFT" as const };
  if (status === "published") return { status: "PUBLISHED" as const };
  return {};
};

const toSummary = (row: CourseRow): CourseSummary => {
  const revision = row.revisions[0];
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    thumbnailAssetId: row.thumbnailAssetId,
    status: row.status,
    lockedAt: row.lockedAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    enrollmentCount: row._count.enrollments,
    currentRevision:
      revision === undefined
        ? null
        : {
            id: revision.id,
            number: revision.number,
            publishedAt: revision.publishedAt?.toISOString() ?? null,
          },
  };
};

const errorCodeOf = (error: unknown): unknown =>
  typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;

const auditedFields = (row: CourseRow) => ({
  slug: row.slug,
  title: row.title,
  description: row.description,
  thumbnailAssetId: row.thumbnailAssetId,
  status: row.status,
});

@Injectable()
export class CoursesService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly audit: AuditService,
    @Inject(COURSE_PUBLISH_CHECKS) private readonly publishChecks: CoursePublishCheck[],
    @Inject(PUBLIC_REVALIDATION) private readonly revalidation: PublicRevalidation,
  ) {}

  async list(query: CourseListQuery): Promise<CourseListResponse> {
    const where = {
      ...statusWhere(query.status),
      ...(query.q === undefined
        ? {}
        : {
            OR: [
              { title: { contains: query.q, mode: "insensitive" as const } },
              { slug: { contains: query.q, mode: "insensitive" as const } },
            ],
          }),
    };
    const [rows, total] = await Promise.all([
      this.database.course.findMany({
        where,
        orderBy: [orderBy(query.sort), { id: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: withSummaryParts,
      }),
      this.database.course.count({ where }),
    ]);
    return { items: rows.map(toSummary), total, page: query.page, pageSize: query.pageSize };
  }

  async get(id: string): Promise<CourseSummary> {
    return toSummary(await this.existing(id, this.database));
  }

  async create(request: CreateCourseRequest): Promise<CourseSummary> {
    await this.assertSlugFree(request.slug);
    await this.assertThumbnail(request.thumbnailAssetId);
    try {
      const created = await this.audit.client(this.database).course.create({
        data: {
          slug: request.slug,
          title: request.title,
          description: request.description,
          thumbnailAssetId: request.thumbnailAssetId,
          revisions: { create: { number: 1 } },
        },
        include: withSummaryParts,
      });
      this.audit.capture({ entityId: created.id, after: auditedFields(created) });
      return toSummary(created);
    } catch (error) {
      throw this.translate(error);
    }
  }

  async update(id: string, request: UpdateCourseRequest): Promise<CourseSummary> {
    const before = await this.existing(id, this.database);
    const latest = before.revisions[0];
    assertLockedEditAllowed(
      { ...before, lockedAt: latest?.publishedAt == null ? null : before.lockedAt },
      request,
    );
    await this.assertSlugFree(request.slug, id);
    await this.assertThumbnail(request.thumbnailAssetId);
    try {
      const updated = await this.audit.client(this.database).course.update({
        where: { id },
        data: {
          slug: request.slug,
          title: request.title,
          description: request.description,
          thumbnailAssetId: request.thumbnailAssetId,
        },
        include: withSummaryParts,
      });
      this.audit.capture({
        entityId: id,
        before: auditedFields(before),
        after: auditedFields(updated),
      });
      this.revalidateAfterCommit(before.slug, updated.slug);
      return toSummary(updated);
    } catch (error) {
      throw this.translate(error);
    }
  }

  async remove(id: string): Promise<void> {
    const client = this.audit.client(this.database);
    const before = await this.existing(id, client);
    assertCanDelete({ status: before.status, enrollmentCount: before._count.enrollments });
    const { count } = await client.course.deleteMany({
      where: { id, status: "DRAFT", enrollments: { none: {} } },
    });
    if (count === 0) {
      const current = await this.existing(id, client);
      assertCanDelete({ status: current.status, enrollmentCount: current._count.enrollments });
      throw new ApiException(409, "COURSE_NOT_DRAFT");
    }
    this.audit.capture({ entityId: id, before: auditedFields(before) });
  }

  async publish(id: string): Promise<CourseSummary> {
    const client = this.audit.client(this.database);
    const before = await this.existing(id, client);
    assertCanPublish(before.status);
    const failures = (
      await Promise.all(this.publishChecks.map((check) => check.failures(id, client)))
    ).flat();
    if (failures.length > 0) throw publishChecksFailed(failures);
    const now = new Date();
    const { count } = await client.course.updateMany({
      where: { id, status: "DRAFT" },
      data: { status: "PUBLISHED", publishedAt: now },
    });
    if (count === 0) throw new ApiException(409, "COURSE_NOT_DRAFT");
    await client.courseRevision.updateMany({
      where: { courseId: id, publishedAt: null },
      data: { publishedAt: now },
    });
    const published = await this.existing(id, client);
    this.audit.capture({
      entityId: id,
      before: { status: before.status },
      after: { status: published.status, publishedAt: now.toISOString() },
    });
    this.revalidateAfterCommit(published.slug);
    return toSummary(published);
  }

  private revalidateAfterCommit(...slugs: string[]): void {
    const tags = [frontPageCacheTag, ...slugs.map(courseCacheTag)];
    this.audit.afterCommit(() => this.revalidation.revalidate(tags));
  }

  private async existing(id: string, client: Pick<HeatClient, "course">): Promise<CourseRow> {
    const row = await client.course.findUnique({ where: { id }, include: withSummaryParts });
    if (row === null) throw new ApiException(404, "NOT_FOUND");
    return row;
  }

  private async assertSlugFree(slug: string, excludeId?: string): Promise<void> {
    const taken = await this.database.course.findFirst({
      where: { slug, ...(excludeId === undefined ? {} : { id: { not: excludeId } }) },
      select: { id: true },
    });
    if (taken !== null) throw new ApiException(409, "COURSE_SLUG_TAKEN");
  }

  private async assertThumbnail(assetId: string | null): Promise<void> {
    if (assetId === null) return;
    const asset = await this.database.mediaAsset.findUnique({
      where: { id: assetId },
      select: { kind: true },
    });
    if (asset === null || asset.kind !== "IMAGE") {
      throw new ApiException(400, "VALIDATION_FAILED", undefined, undefined, [
        { path: "thumbnailAssetId", code: "invalid" },
      ]);
    }
  }

  private translate(error: unknown): unknown {
    if (error instanceof ApiException) return error;
    if (errorCodeOf(error) === "P2002") return new ApiException(409, "COURSE_SLUG_TAKEN");
    if (errorCodeOf(error) === "P2025") return new ApiException(404, "NOT_FOUND");
    return error;
  }
}

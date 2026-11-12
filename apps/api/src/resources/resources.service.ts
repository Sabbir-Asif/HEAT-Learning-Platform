import { Inject, Injectable } from "@nestjs/common";
import { resourcesCacheTag } from "@heat/contracts";
import type {
  ResourceAdmin,
  ResourceAdminListQuery,
  ResourceAdminListResponse,
  ResourceRequest,
} from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { AuditService } from "../audit";
import { PUBLIC_REVALIDATION, CourseLookupService } from "../catalog";
import type { PublicRevalidation } from "../catalog";
import { CLOCK, DATABASE } from "../core";
import type { Clock } from "../core";
import { ApiException } from "../http/api-exception";
import { MediaService, MediaUrlService } from "../media";
import { orderBy, resourceEntity, statusWhere } from "./resource-rules";

type ResourceClient = Pick<HeatClient, "resource" | "mediaAsset" | "course">;

const resourceSelect = {
  id: true,
  kind: true,
  title: true,
  description: true,
  url: true,
  mediaAssetId: true,
  courseId: true,
  displayOrder: true,
  published: true,
  createdAt: true,
  updatedAt: true,
  course: { select: { title: true } },
  mediaAsset: {
    select: {
      id: true,
      key: true,
      kind: true,
      visibility: true,
      mimeType: true,
      sizeBytes: true,
      width: true,
      height: true,
      altText: true,
      variants: true,
    },
  },
} as const;

interface ResourceRow {
  id: string;
  kind: "FILE" | "LINK";
  title: string;
  description: string | null;
  url: string | null;
  mediaAssetId: string | null;
  courseId: string | null;
  displayOrder: number;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
  course: { title: string } | null;
  mediaAsset: {
    id: string;
    key: string;
    kind: "IMAGE" | "DOCUMENT";
    visibility: "PUBLIC" | "PROTECTED" | "PRIVATE";
    mimeType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    altText: string | null;
    variants: unknown;
  } | null;
}

const auditedFields = (row: ResourceRow) => ({
  kind: row.kind === "FILE" ? "file" : "link",
  title: row.title,
  url: row.url,
  mediaAssetId: row.mediaAssetId,
  courseId: row.courseId,
  displayOrder: row.displayOrder,
  published: row.published,
});

const invalid = (path: string): ApiException =>
  new ApiException(400, "VALIDATION_FAILED", undefined, undefined, [{ path, code: "invalid" }]);

@Injectable()
export class ResourcesService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly audit: AuditService,
    private readonly media: MediaService,
    private readonly urls: MediaUrlService,
    private readonly courses: CourseLookupService,
    @Inject(PUBLIC_REVALIDATION) private readonly revalidation: PublicRevalidation,
  ) {}

  async list(query: ResourceAdminListQuery): Promise<ResourceAdminListResponse> {
    const where = {
      deletedAt: null,
      ...statusWhere(query.status),
      ...(query.q === undefined
        ? {}
        : { title: { contains: query.q, mode: "insensitive" as const } }),
    };
    const [rows, total] = await Promise.all([
      this.database.resource.findMany({
        where,
        orderBy: [orderBy(query.sort), { createdAt: "desc" }, { id: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: resourceSelect,
      }),
      this.database.resource.count({ where }),
    ]);
    return {
      items: rows.map((row) => this.present(row)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string): Promise<ResourceAdmin> {
    return this.present(await this.existing(this.database, id));
  }

  async create(request: ResourceRequest): Promise<ResourceAdmin> {
    const client = this.audit.client(this.database);
    await this.assertCourse(client, request.courseId);
    const created = await client.resource.create({
      data: {
        kind: request.kind === "file" ? "FILE" : "LINK",
        title: request.title,
        description: request.description,
        url: request.url,
        displayOrder: request.displayOrder,
        published: request.published,
        courseId: request.courseId,
      },
      select: { id: true },
    });
    if (request.mediaAssetId !== null) {
      await this.media.linkPublicDocument(request.mediaAssetId, resourceEntity, created.id, client);
      await client.resource.update({
        where: { id: created.id },
        data: { mediaAssetId: request.mediaAssetId },
      });
    }
    const row = await this.existing(client, created.id);
    this.audit.capture({ entityId: row.id, after: auditedFields(row) });
    this.revalidateAfterCommit();
    return this.present(row);
  }

  async update(id: string, request: ResourceRequest): Promise<ResourceAdmin> {
    const client = this.audit.client(this.database);
    const before = await this.existing(client, id);
    await this.assertCourse(client, request.courseId);
    if (before.mediaAssetId !== null && before.mediaAssetId !== request.mediaAssetId) {
      await this.media.unlink(before.mediaAssetId, resourceEntity, id, client);
    }
    if (request.mediaAssetId !== null) {
      await this.media.linkPublicDocument(request.mediaAssetId, resourceEntity, id, client);
    }
    await client.resource.update({
      where: { id },
      data: {
        kind: request.kind === "file" ? "FILE" : "LINK",
        title: request.title,
        description: request.description,
        url: request.url,
        mediaAssetId: request.mediaAssetId,
        courseId: request.courseId,
        displayOrder: request.displayOrder,
        published: request.published,
      },
    });
    const after = await this.existing(client, id);
    this.audit.capture({
      entityId: id,
      before: auditedFields(before),
      after: auditedFields(after),
    });
    this.revalidateAfterCommit();
    return this.present(after);
  }

  async remove(id: string): Promise<void> {
    const client = this.audit.client(this.database);
    const before = await this.existing(client, id);
    await client.resource.update({
      where: { id },
      data: { deletedAt: this.clock.now(), mediaAssetId: null, published: false },
    });
    if (before.mediaAssetId !== null) {
      await this.media.unlink(before.mediaAssetId, resourceEntity, id, client);
    }
    this.audit.capture({ entityId: id, before: auditedFields(before) });
    this.revalidateAfterCommit();
  }

  private revalidateAfterCommit(): void {
    this.audit.afterCommit(() => this.revalidation.revalidate([resourcesCacheTag]));
  }

  private async assertCourse(client: ResourceClient, courseId: string | null): Promise<void> {
    if (courseId === null) return;
    if (!(await this.courses.isActive(courseId, client))) throw invalid("courseId");
  }

  private async existing(client: ResourceClient, id: string): Promise<ResourceRow> {
    const row = await client.resource.findFirst({
      where: { id, deletedAt: null },
      select: resourceSelect,
    });
    if (row === null) throw new ApiException(404, "NOT_FOUND");
    return row;
  }

  private present(row: ResourceRow): ResourceAdmin {
    return {
      id: row.id,
      kind: row.kind === "FILE" ? "file" : "link",
      title: row.title,
      description: row.description,
      url: row.url,
      file:
        row.mediaAsset === null
          ? null
          : {
              assetId: row.mediaAsset.id,
              mimeType: row.mediaAsset.mimeType,
              sizeBytes: row.mediaAsset.sizeBytes,
              url: this.urls.describe(row.mediaAsset, "admin").url,
            },
      courseId: row.courseId,
      courseTitle: row.course?.title ?? null,
      displayOrder: row.displayOrder,
      published: row.published,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

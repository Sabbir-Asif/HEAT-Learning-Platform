import { Inject, Injectable } from "@nestjs/common";
import {
  newsListCacheTag,
  newsPostCacheTag,
  parseRichText,
  richTextImageIds,
} from "@heat/contracts";
import type {
  NewsAdminListQuery,
  NewsAdminListResponse,
  NewsAdminPost,
  NewsPostRequest,
  NewsStatus,
  RichTextDoc,
} from "@heat/contracts";
import type { HeatClient, Prisma } from "@heat/db";
import { AuditService } from "../audit";
import { CLOCK, DATABASE } from "../core";
import type { Clock } from "../core";
import { ApiException } from "../http/api-exception";
import { MediaUrlService } from "../media";
import { PUBLIC_REVALIDATION } from "../catalog";
import type { PublicRevalidation } from "../catalog";
import { newsState, pickSlug, planPublishedAt } from "./news-rules";

type NewsClient = Pick<HeatClient, "newsPost" | "mediaAsset">;

const linkedEntity = "NewsPost";

const imageSelect = {
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
} as const;

const postSelect = {
  id: true,
  authorId: true,
  slug: true,
  title: true,
  body: true,
  schemaVersion: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

interface PostRow {
  id: string;
  authorId: string;
  slug: string;
  title: string;
  body: unknown;
  schemaVersion: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const asJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

const invalidBody = (): ApiException =>
  new ApiException(400, "VALIDATION_FAILED", undefined, undefined, [
    { path: "body", code: "invalid" },
  ]);

const emptyDoc: RichTextDoc = { type: "doc", content: [] };

const orderBy = (sort: NewsAdminListQuery["sort"]) => {
  switch (sort) {
    case "title":
      return { title: "asc" as const };
    case "-title":
      return { title: "desc" as const };
    case "publishedAt":
      return { publishedAt: "asc" as const };
    case "-publishedAt":
      return { publishedAt: "desc" as const };
    case "updatedAt":
      return { updatedAt: "asc" as const };
    default:
      return { updatedAt: "desc" as const };
  }
};

const statusWhere = (status: NewsStatus | "all", now: Date) => {
  if (status === "draft") return { publishedAt: null };
  if (status === "scheduled") return { publishedAt: { gt: now } };
  if (status === "published") return { publishedAt: { lte: now } };
  return {};
};

const auditedFields = (row: PostRow, now: Date) => ({
  slug: row.slug,
  title: row.title,
  status: newsState(row.publishedAt, now),
  publishedAt: row.publishedAt?.toISOString() ?? null,
});

@Injectable()
export class NewsService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly audit: AuditService,
    private readonly media: MediaUrlService,
    @Inject(PUBLIC_REVALIDATION) private readonly revalidation: PublicRevalidation,
  ) {}

  async list(query: NewsAdminListQuery): Promise<NewsAdminListResponse> {
    const now = this.clock.now();
    const where = {
      deletedAt: null,
      ...statusWhere(query.status, now),
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
      this.database.newsPost.findMany({
        where,
        orderBy: [orderBy(query.sort), { id: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: postSelect,
      }),
      this.database.newsPost.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        status: newsState(row.publishedAt, now),
        publishedAt: row.publishedAt?.toISOString() ?? null,
        updatedAt: row.updatedAt.toISOString(),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string): Promise<NewsAdminPost> {
    return this.present(this.database, await this.existing(this.database, id));
  }

  async create(authorId: string, request: NewsPostRequest): Promise<NewsAdminPost> {
    const parsed = parseRichText(request.body);
    if (!parsed.ok) throw invalidBody();
    const client = this.audit.client(this.database);
    const now = this.clock.now();
    const slug = await this.freeSlug(client, request.title);
    const created = await client.newsPost.create({
      data: {
        authorId,
        slug,
        title: request.title,
        body: asJson(parsed.doc),
        schemaVersion: request.schemaVersion,
        publishedAt: planPublishedAt(request, now),
      },
      select: postSelect,
    });
    await this.linkImages(client, created.id, richTextImageIds(parsed.doc));
    this.audit.capture({ entityId: created.id, after: auditedFields(created, now) });
    this.revalidateAfterCommit(created.slug);
    return this.present(client, created);
  }

  async update(id: string, request: NewsPostRequest): Promise<NewsAdminPost> {
    const parsed = parseRichText(request.body);
    if (!parsed.ok) throw invalidBody();
    const client = this.audit.client(this.database);
    const now = this.clock.now();
    const before = await this.existing(client, id);
    await this.linkImages(client, id, richTextImageIds(parsed.doc));
    const updated = await client.newsPost.update({
      where: { id },
      data: {
        title: request.title,
        body: asJson(parsed.doc),
        schemaVersion: request.schemaVersion,
        publishedAt: planPublishedAt(request, now, before.publishedAt),
      },
      select: postSelect,
    });
    this.audit.capture({
      entityId: id,
      before: auditedFields(before, now),
      after: auditedFields(updated, now),
    });
    this.revalidateAfterCommit(updated.slug);
    return this.present(client, updated);
  }

  async remove(id: string): Promise<void> {
    const client = this.audit.client(this.database);
    const before = await this.existing(client, id);
    await client.newsPost.update({ where: { id }, data: { deletedAt: this.clock.now() } });
    this.audit.capture({ entityId: id, before: auditedFields(before, this.clock.now()) });
    this.revalidateAfterCommit(before.slug);
  }

  private revalidateAfterCommit(slug: string): void {
    const tags = [newsListCacheTag, newsPostCacheTag(slug)];
    this.audit.afterCommit(() => this.revalidation.revalidate(tags));
  }

  private async existing(client: NewsClient, id: string): Promise<PostRow> {
    const row = await client.newsPost.findFirst({
      where: { id, deletedAt: null },
      select: postSelect,
    });
    if (row === null) throw new ApiException(404, "NOT_FOUND");
    return row;
  }

  private async freeSlug(client: NewsClient, title: string): Promise<string> {
    const stem = pickSlug(title, new Set());
    const rows = await client.newsPost.findMany({
      where: { slug: { startsWith: stem } },
      select: { slug: true },
    });
    return pickSlug(title, new Set(rows.map((row) => row.slug)));
  }

  private async linkImages(client: NewsClient, postId: string, assetIds: string[]): Promise<void> {
    const unique = [...new Set(assetIds)];
    if (unique.length === 0) return;
    const assets = await client.mediaAsset.findMany({
      where: { id: { in: unique }, deletedAt: null, kind: "IMAGE", visibility: "PUBLIC" },
      select: { id: true, linkedEntity: true, linkedId: true },
    });
    const usable = assets.filter(
      (asset) =>
        asset.linkedEntity === null ||
        (asset.linkedEntity === linkedEntity && asset.linkedId === postId),
    );
    if (usable.length !== unique.length) throw invalidBody();
    await client.mediaAsset.updateMany({
      where: { id: { in: unique }, linkedEntity: null },
      data: { linkedEntity, linkedId: postId },
    });
  }

  private async present(client: NewsClient, row: PostRow): Promise<NewsAdminPost> {
    const parsed = parseRichText(row.body);
    const doc = parsed.ok ? parsed.doc : emptyDoc;
    const ids = [...new Set(richTextImageIds(doc))];
    const assets =
      ids.length === 0
        ? []
        : await client.mediaAsset.findMany({
            where: { id: { in: ids }, deletedAt: null },
            select: imageSelect,
          });
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      status: newsState(row.publishedAt, this.clock.now()),
      publishedAt: row.publishedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      authorId: row.authorId,
      schemaVersion: row.schemaVersion,
      body: { ...doc },
      images: assets.map((asset) => ({
        assetId: asset.id,
        url: this.media.describe(asset, "admin").url,
        alt: asset.altText ?? "",
      })),
    };
  }
}

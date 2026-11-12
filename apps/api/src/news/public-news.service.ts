import { Inject, Injectable } from "@nestjs/common";
import { newsPublicPageSize, parseRichText, richTextImageIds } from "@heat/contracts";
import type {
  NewsPublicListQuery,
  NewsPublicListResponse,
  NewsPublicPost,
  RichTextDoc,
} from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { PublicImagesService } from "../catalog";
import { CLOCK, DATABASE } from "../core";
import type { Clock } from "../core";
import { ApiException } from "../http/api-exception";
import { coverAssetIdOf, summaryOf } from "./news-rules";

const emptyDoc: RichTextDoc = { type: "doc", content: [] };

const docOf = (value: unknown): RichTextDoc => {
  const parsed = parseRichText(value);
  return parsed.ok ? parsed.doc : emptyDoc;
};

@Injectable()
export class PublicNewsService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly images: PublicImagesService,
  ) {}

  async list(query: NewsPublicListQuery): Promise<NewsPublicListResponse> {
    const where = { deletedAt: null, publishedAt: { not: null, lte: this.clock.now() } };
    const [rows, total] = await Promise.all([
      this.database.newsPost.findMany({
        where,
        orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
        skip: (query.page - 1) * newsPublicPageSize,
        take: newsPublicPageSize,
        select: { slug: true, title: true, body: true, publishedAt: true },
      }),
      this.database.newsPost.count({ where }),
    ]);
    const docs = rows.map((row) => docOf(row.body));
    const images = await this.images.resolve(docs.map(coverAssetIdOf));
    return {
      items: rows.flatMap((row, index) => {
        const doc = docs[index] ?? emptyDoc;
        const coverId = coverAssetIdOf(doc);
        if (row.publishedAt === null) return [];
        return [
          {
            slug: row.slug,
            title: row.title,
            summary: summaryOf(doc),
            publishedAt: row.publishedAt.toISOString(),
            cover: coverId === null ? null : (images.get(coverId) ?? null),
          },
        ];
      }),
      total,
      page: query.page,
      pageSize: newsPublicPageSize,
    };
  }

  async get(slug: string): Promise<NewsPublicPost> {
    const row = await this.database.newsPost.findFirst({
      where: { slug, deletedAt: null, publishedAt: { not: null, lte: this.clock.now() } },
      select: { slug: true, title: true, body: true, schemaVersion: true, publishedAt: true },
    });
    if (row === null || row.publishedAt === null) throw new ApiException(404, "NOT_FOUND");
    const doc = docOf(row.body);
    const images = await this.images.resolve(richTextImageIds(doc));
    return {
      slug: row.slug,
      title: row.title,
      publishedAt: row.publishedAt.toISOString(),
      schemaVersion: row.schemaVersion,
      body: { ...doc },
      images: [...images.values()],
    };
  }
}

import { describe, expect, test, vi } from "vitest";
import { PublicNewsService } from "../../src/news/public-news.service";

const now = new Date("2026-11-12T06:00:00.000Z");

const body = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }],
};

const build = (rows: unknown[], found: unknown = null) => {
  const database = {
    newsPost: {
      findMany: vi.fn().mockResolvedValue(rows),
      count: vi.fn().mockResolvedValue(rows.length),
      findFirst: vi.fn().mockResolvedValue(found),
    },
  };
  const images = { resolve: vi.fn().mockResolvedValue(new Map()) };
  const service = new PublicNewsService(database as never, { now: () => now }, images as never);
  return { service, database };
};

describe("PublicNewsService", () => {
  test("lists only posts that are published by now, newest first", async () => {
    const { service, database } = build([
      { slug: "a", title: "A", body, publishedAt: new Date("2026-11-10T00:00:00.000Z") },
    ]);
    const result = await service.list({ page: 1 });
    expect(database.newsPost.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { deletedAt: null, publishedAt: { not: null, lte: now } },
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    });
    expect(result.items[0]).toMatchObject({ slug: "a", summary: "Hi", cover: null });
  });

  test("answers 404 for a draft, scheduled or deleted slug", async () => {
    const { service, database } = build([], null);
    await expect(service.get("draft-post")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(database.newsPost.findFirst.mock.calls[0]?.[0].where).toMatchObject({
      slug: "draft-post",
      deletedAt: null,
      publishedAt: { not: null, lte: now },
    });
  });

  test("returns the article body for a published slug", async () => {
    const { service } = build([], {
      slug: "a",
      title: "A",
      body,
      schemaVersion: 1,
      publishedAt: new Date("2026-11-10T00:00:00.000Z"),
    });
    const result = await service.get("a");
    expect(result).toMatchObject({ slug: "a", title: "A", images: [] });
  });
});

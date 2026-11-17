import type { HeatClient } from "@heat/db";
import { describe, expect, test, vi } from "vitest";
import { PrismaNewsPublicationStore } from "../../src/news/prisma-news-publication-store";

const payload = {
  postId: "0b1f6a0e-2b6a-4f4e-9c1a-5a1f6a0e2b6a",
  slug: "orientation",
  title: "Orientation",
};
const post = { id: payload.postId, slug: payload.slug, title: payload.title };

const fakeDatabase = (existing: { id: string } | null) => {
  const findFirst = vi.fn().mockResolvedValue(existing);
  const create = vi.fn().mockResolvedValue({});
  const findMany = vi.fn().mockResolvedValue([post]);
  const tx = { outbox: { findFirst, create } };
  const transaction = vi.fn(async (run: (client: typeof tx) => Promise<boolean>) => run(tx));
  const database = { newsPost: { findMany }, $transaction: transaction } as unknown as HeatClient;
  return { database, findFirst, create, findMany };
};

describe("PrismaNewsPublicationStore", () => {
  test("finds live posts published inside the window, oldest first", async () => {
    const { database, findMany } = fakeDatabase(null);
    const now = new Date("2026-11-12T06:00:00.000Z");
    const since = new Date("2026-11-12T05:00:00.000Z");

    const found = await new PrismaNewsPublicationStore(database).findUnannounced(now, since);

    expect(found).toEqual([post]);
    expect(findMany).toHaveBeenCalledWith({
      where: { deletedAt: null, publishedAt: { gt: since, lte: now } },
      orderBy: { publishedAt: "asc" },
      select: { id: true, slug: true, title: true },
    });
  });

  test("writes an outbox event once for a post not yet announced", async () => {
    const { database, findFirst, create } = fakeDatabase(null);

    const written = await new PrismaNewsPublicationStore(database).announce(
      post,
      "news.published",
      payload,
    );

    expect(written).toBe(true);
    expect(findFirst).toHaveBeenCalledWith({
      where: { eventType: "news.published", payload: { path: ["postId"], equals: post.id } },
      select: { id: true },
    });
    expect(create).toHaveBeenCalledWith({ data: { eventType: "news.published", payload } });
  });

  test("writes nothing when the post was already announced", async () => {
    const { database, create } = fakeDatabase({ id: "existing" });

    const written = await new PrismaNewsPublicationStore(database).announce(
      post,
      "news.published",
      payload,
    );

    expect(written).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });
});

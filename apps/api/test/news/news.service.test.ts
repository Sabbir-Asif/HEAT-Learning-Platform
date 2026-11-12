import { describe, expect, test, vi } from "vitest";
import { AuditService } from "../../src/audit";
import { auditScopeStorage } from "../../src/audit/audit-scope";
import type { AuditChange } from "../../src/audit";
import { NewsService } from "../../src/news/news.service";

const postId = "0198f1a0-0000-7000-8000-0000000000e1";
const authorId = "0198f1a0-0000-7000-8000-0000000000b1";
const assetId = "0198f1a0-0000-7000-8000-0000000000a1";
const now = new Date("2026-11-12T06:00:00.000Z");

const doc = (...content: unknown[]) => ({ type: "doc", content });

const paragraph = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });

const request = (overrides: Record<string, unknown> = {}) => ({
  title: "Orientation",
  schemaVersion: 1 as const,
  body: doc(paragraph("Hello")),
  status: "draft" as const,
  publishedAt: null,
  ...overrides,
});

const row = (overrides: Record<string, unknown> = {}) => ({
  id: postId,
  authorId,
  slug: "orientation",
  title: "Orientation",
  body: doc(paragraph("Hello")),
  schemaVersion: 1,
  publishedAt: null,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const build = (options: { existing?: unknown; slugs?: string[]; assets?: unknown[] } = {}) => {
  const database = {
    newsPost: {
      findFirst: vi.fn().mockResolvedValue(options.existing ?? null),
      findMany: vi.fn().mockResolvedValue((options.slugs ?? []).map((slug) => ({ slug }))),
      count: vi.fn().mockResolvedValue(0),
      create: vi
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve(row({ slug: data.slug, publishedAt: data.publishedAt })),
        ),
      update: vi
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve(row({ ...data })),
        ),
    },
    mediaAsset: {
      findMany: vi.fn().mockResolvedValue(options.assets ?? []),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const revalidate = vi.fn().mockResolvedValue(undefined);
  const service = new NewsService(
    database as never,
    { now: () => now },
    new AuditService({} as never),
    { describe: vi.fn().mockReturnValue({ url: "/media/x/w640.webp" }) } as never,
    { revalidate } as never,
  );
  const changes: AuditChange[] = [];
  const afterCommit: Array<() => Promise<void>> = [];
  const scope = { tx: database as never, changes, afterCommit, skipped: false };
  const inAuditScope = <T>(run: () => Promise<T>): Promise<T> => auditScopeStorage.run(scope, run);
  return { service, database, changes, afterCommit, revalidate, inAuditScope };
};

const failureOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => undefined,
    (error: unknown) => error,
  );

describe("NewsService.create", () => {
  test("saves a draft with no publish date and revalidates the news tags", async () => {
    const { service, database, afterCommit, revalidate, inAuditScope } = build();
    const result = await inAuditScope(() => service.create(authorId, request()));
    expect(database.newsPost.create.mock.calls[0]?.[0].data).toMatchObject({
      authorId,
      slug: "orientation",
      publishedAt: null,
    });
    expect(result.status).toBe("draft");
    await afterCommit[0]?.();
    expect(revalidate).toHaveBeenCalledWith(["news", "news:orientation"]);
  });

  test("gives a second post with the same title a different slug", async () => {
    const { service, database, inAuditScope } = build({ slugs: ["orientation"] });
    await inAuditScope(() => service.create(authorId, request()));
    expect(database.newsPost.create.mock.calls[0]?.[0].data.slug).toBe("orientation-2");
  });

  test("schedules a post whose publish date is in the future", async () => {
    const { service, inAuditScope } = build();
    const result = await inAuditScope(() =>
      service.create(
        authorId,
        request({ status: "published", publishedAt: "2026-12-01T09:00:00+06:00" }),
      ),
    );
    expect(result.status).toBe("scheduled");
  });

  test("rejects a body outside the allow-list without writing", async () => {
    const { service, database, inAuditScope } = build();
    const unsafe = doc({
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "x",
          marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
        },
      ],
    });
    const error = await failureOf(
      inAuditScope(() => service.create(authorId, request({ body: unsafe }))),
    );
    expect(error).toMatchObject({ code: "VALIDATION_FAILED" });
    expect(database.newsPost.create).not.toHaveBeenCalled();
  });

  test("rejects an image that is not a public image asset", async () => {
    const image = { type: "image", attrs: { assetId, alt: "Team" } };
    const { service, inAuditScope } = build({ assets: [] });
    const error = await failureOf(
      inAuditScope(() => service.create(authorId, request({ body: doc(image) }))),
    );
    expect(error).toMatchObject({ code: "VALIDATION_FAILED" });
  });

  test("keeps the asset id, never a url, in the stored body and links the asset", async () => {
    const image = { type: "image", attrs: { assetId, alt: "Team" } };
    const { service, database, inAuditScope } = build({
      assets: [{ id: assetId, linkedEntity: null, linkedId: null }],
    });
    await inAuditScope(() => service.create(authorId, request({ body: doc(image) })));
    const stored = JSON.stringify(database.newsPost.create.mock.calls[0]?.[0]);
    expect(stored).toContain(assetId);
    expect(stored).not.toContain("/media/");
    expect(database.mediaAsset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { linkedEntity: "NewsPost", linkedId: postId } }),
    );
  });
});

describe("NewsService.update and remove", () => {
  test("audits the change and clears the date when saved as a draft", async () => {
    const { service, database, changes, inAuditScope } = build({
      existing: row({ publishedAt: new Date("2026-11-01T00:00:00.000Z") }),
    });
    await inAuditScope(() => service.update(postId, request()));
    expect(database.newsPost.update.mock.calls[0]?.[0].data.publishedAt).toBeNull();
    expect(changes[0]?.before).toMatchObject({ status: "published" });
    expect(changes[0]?.after).toMatchObject({ status: "draft" });
  });

  test("returns not found for a missing post", async () => {
    const { service, inAuditScope } = build();
    const error = await failureOf(inAuditScope(() => service.update(postId, request())));
    expect(error).toMatchObject({ code: "NOT_FOUND" });
  });

  test("soft deletes instead of removing the row", async () => {
    const { service, database, inAuditScope } = build({ existing: row() });
    await inAuditScope(() => service.remove(postId));
    expect(database.newsPost.update).toHaveBeenCalledWith({
      where: { id: postId },
      data: { deletedAt: now },
    });
  });
});

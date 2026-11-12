import { describe, expect, test, vi } from "vitest";
import { AuditService } from "../../src/audit";
import { auditScopeStorage } from "../../src/audit/audit-scope";
import type { AuditChange } from "../../src/audit";
import { LessonSectionsService } from "../../src/catalog/lesson-sections.service";

const courseId = "0198f1a0-0000-7000-8000-0000000000c1";
const assetId = "0198f1a0-0000-7000-8000-0000000000a1";
const at = new Date("2026-11-11T06:00:00.000Z");

const paragraph = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

const doc = (...content: unknown[]) => ({ type: "doc", content });

const build = (options: { lockedAt?: Date | null; stored: unknown; assets?: unknown[] }) => {
  const database = {
    $queryRaw: vi.fn().mockResolvedValue([{ lockedAt: options.lockedAt ?? null }]),
    course: {
      findUnique: vi.fn().mockResolvedValue({
        lockedAt: options.lockedAt ?? null,
        revisions: [{ id: "rev" }],
      }),
    },
    module: {
      findFirst: vi.fn().mockResolvedValue({
        id: "m",
        order: 1,
        title: "Module",
        objectives: [],
        createdAt: at,
        updatedAt: at,
        lessonSections: [],
      }),
    },
    lessonSection: {
      findFirst: vi.fn().mockResolvedValue({
        id: "s",
        title: "Section",
        schemaVersion: 1,
        body: options.stored,
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    mediaAsset: {
      findMany: vi.fn().mockResolvedValue(options.assets ?? []),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const service = new LessonSectionsService(database as never, new AuditService({} as never), {
    describe: vi.fn().mockReturnValue({ url: "/media/x/w640.webp" }),
  } as never);
  const changes: AuditChange[] = [];
  const scope = { tx: database as never, changes, afterCommit: [], skipped: false };
  const inAuditScope = <T>(run: () => Promise<T>): Promise<T> => auditScopeStorage.run(scope, run);
  return { service, database, changes, inAuditScope };
};

const failureOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => undefined,
    (error: unknown) => error,
  );

const request = (body: unknown) => ({ schemaVersion: 1 as const, body: body as never });

describe("LessonSectionsService.updateBody", () => {
  test("stores a valid body and audits the text changes", async () => {
    const { service, database, changes, inAuditScope } = build({
      stored: doc(paragraph("Helo")),
    });
    await inAuditScope(() =>
      service.updateBody(courseId, "m", "s", request(doc(paragraph("Hello")))),
    );
    expect(database.lessonSection.update.mock.calls[0]?.[0].data).toMatchObject({
      body: doc(paragraph("Hello")),
      schemaVersion: 1,
    });
    expect(changes[0]?.after).toMatchObject({
      changes: [{ block: 1, before: "Helo", after: "Hello" }],
    });
  });

  test("rejects an unknown node and does not write", async () => {
    const { service, database, inAuditScope } = build({ stored: doc() });
    const failure = await failureOf(
      inAuditScope(() =>
        service.updateBody(courseId, "m", "s", request(doc({ type: "script", content: [] }))),
      ),
    );
    expect(failure).toMatchObject({ code: "VALIDATION_FAILED" });
    expect(database.lessonSection.update).not.toHaveBeenCalled();
  });

  test("rejects an image whose asset is not an unlinked or own image", async () => {
    const { service, inAuditScope } = build({ stored: doc(), assets: [] });
    const body = doc({ type: "image", attrs: { assetId, alt: "A poster" } });
    expect(
      await failureOf(inAuditScope(() => service.updateBody(courseId, "m", "s", request(body)))),
    ).toMatchObject({ code: "VALIDATION_FAILED" });
  });

  test("links a new image to the section", async () => {
    const { service, database, inAuditScope } = build({
      stored: doc(),
      assets: [{ id: assetId, linkedEntity: null, linkedId: null }],
    });
    const body = doc({ type: "image", attrs: { assetId, alt: "A poster" } });
    await inAuditScope(() => service.updateBody(courseId, "m", "s", request(body)));
    expect(database.mediaAsset.updateMany.mock.calls[0]?.[0].data).toEqual({
      linkedEntity: "LessonSection",
      linkedId: "s",
    });
  });

  describe("on a locked course", () => {
    test("accepts a wording fix", async () => {
      const { service, database, inAuditScope } = build({
        lockedAt: at,
        stored: doc(paragraph("Helo world")),
      });
      await inAuditScope(() =>
        service.updateBody(courseId, "m", "s", request(doc(paragraph("Hello world")))),
      );
      expect(database.lessonSection.update).toHaveBeenCalledTimes(1);
    });

    test("refuses a split paragraph with CONTENT_LOCKED", async () => {
      const { service, database, inAuditScope } = build({
        lockedAt: at,
        stored: doc(paragraph("One two")),
      });
      const failure = await failureOf(
        inAuditScope(() =>
          service.updateBody(courseId, "m", "s", request(doc(paragraph("One"), paragraph("two")))),
        ),
      );
      expect(failure).toMatchObject({ code: "CONTENT_LOCKED" });
      expect(database.lessonSection.update).not.toHaveBeenCalled();
    });
  });
});

describe("LessonSectionsService.readBody", () => {
  test("returns the body with image urls", async () => {
    const stored = doc({ type: "image", attrs: { assetId, alt: "A poster" } });
    const { service } = build({
      stored,
      assets: [{ id: assetId, altText: "A poster" }],
    });
    const result = await service.readBody(courseId, "m", "s");
    expect(result.images).toEqual([{ assetId, url: "/media/x/w640.webp", alt: "A poster" }]);
    expect(result.body).toEqual(stored);
  });
});

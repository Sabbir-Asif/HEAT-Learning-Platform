import { describe, expect, test, vi } from "vitest";
import { AuditService } from "../../src/audit";
import { auditScopeStorage } from "../../src/audit/audit-scope";
import type { AuditChange } from "../../src/audit";
import { RevisionsService } from "../../src/catalog/revisions.service";
import { ApiException } from "../../src/http/api-exception";

const courseId = "0198f1a0-0000-7000-8000-0000000000c1";
const revisionId = "0198f1a0-0000-7000-8000-0000000000e1";
const newRevisionId = "0198f1a0-0000-7000-8000-0000000000e2";
const at = new Date("2026-11-11T06:00:00.000Z");

const revisionRow = (overrides: Record<string, unknown> = {}) => ({
  id: revisionId,
  number: 1,
  publishedAt: at,
  createdAt: at,
  _count: { enrollments: 2 },
  ...overrides,
});

const source = (overrides: Record<string, unknown> = {}) => ({
  id: revisionId,
  number: 1,
  publishedAt: at,
  modules: [
    {
      order: 1,
      title: "Module one",
      objectives: ["Know the policy"],
      tags: [{ tagId: "tag", displayOrder: 0 }],
      lessonSections: [{ order: 1, title: "Intro", body: {}, schemaVersion: 1, objectives: ["a"] }],
      videos: [
        { order: 1, title: "Video A", required: true, assetId: "asset-a" },
        { order: 2, title: "Video B", required: false, assetId: "asset-a" },
        { order: 3, title: "Empty", required: false, assetId: null },
      ],
      quiz: {
        deletedAt: null,
        passMarkPercent: 70,
        attemptLimit: null,
        waitMinutes: 10,
        questions: [
          {
            order: 1,
            type: "SINGLE_CHOICE",
            text: "Q",
            explanation: null,
            options: [
              { order: 1, text: "Yes", isCorrect: true },
              { order: 2, text: "No", isCorrect: false },
            ],
          },
        ],
      },
    },
    {
      order: 2,
      title: "Module two",
      objectives: [],
      tags: [],
      lessonSections: [],
      videos: [],
      quiz: null,
    },
  ],
  ...overrides,
});

const build = (
  options: {
    latest?: Record<string, unknown>;
    courseStatus?: string;
    checks?: string[][];
    updateCount?: number;
    createError?: Error;
  } = {},
) => {
  const latest = options.latest ?? source();
  const database = {
    $queryRaw: vi.fn().mockResolvedValue([{ lockedAt: at }]),
    course: {
      findUnique: vi.fn().mockImplementation((args: { select: Record<string, unknown> }) =>
        Promise.resolve(
          "status" in args.select
            ? { status: options.courseStatus ?? "PUBLISHED" }
            : "revisions" in args.select
              ? {
                  lockedAt: at,
                  revisions: [{ id: latest.id, publishedAt: latest.publishedAt }],
                }
              : { id: courseId },
        ),
      ),
    },
    courseRevision: {
      findUnique: vi
        .fn()
        .mockImplementation((args: { where: { id: string }; select: Record<string, unknown> }) =>
          Promise.resolve(
            "_count" in args.select
              ? revisionRow({ id: args.where.id, publishedAt: new Date() })
              : latest,
          ),
        ),
      findFirst: vi.fn().mockResolvedValue({ id: revisionId }),
      findMany: vi.fn().mockResolvedValue([
        revisionRow({
          id: newRevisionId,
          number: 2,
          publishedAt: null,
          _count: { enrollments: 0 },
        }),
        revisionRow(),
      ]),
      create: options.createError
        ? vi.fn().mockRejectedValue(options.createError)
        : vi.fn().mockResolvedValue(
            revisionRow({
              id: newRevisionId,
              number: 2,
              publishedAt: null,
              _count: { enrollments: 0 },
            }),
          ),
      updateMany: vi.fn().mockResolvedValue({ count: options.updateCount ?? 1 }),
    },
    videoAsset: { update: vi.fn().mockResolvedValue({}) },
  };
  const checks = (options.checks ?? []).map((failures) => ({
    failures: vi.fn().mockResolvedValue(failures),
  }));
  const service = new RevisionsService(
    database as never,
    new AuditService({} as never),
    checks as never,
  );
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

const codeOf = async (promise: Promise<unknown>): Promise<unknown> => {
  const error = await failureOf(promise);
  return error instanceof ApiException ? error.code : error;
};

describe("RevisionsService.list", () => {
  test("lists revisions newest first with status, lock state and enrollment counts", async () => {
    const { service } = build();

    const { items } = await service.list(courseId);

    expect(items.map((item) => [item.number, item.status, item.locked, item.current])).toEqual([
      [2, "DRAFT", false, true],
      [1, "PUBLISHED", true, false],
    ]);
    expect(items[1]?.enrollmentCount).toBe(2);
  });
});

describe("RevisionsService.clone", () => {
  test("copies the content into a new draft and counts every video slot", async () => {
    const { service, database, changes, inAuditScope } = build();

    const item = await inAuditScope(() => service.clone(courseId));

    expect(item).toMatchObject({ id: newRevisionId, number: 2, status: "DRAFT", locked: false });
    const data = database.courseRevision.create.mock.calls[0]?.[0].data;
    expect(data.number).toBe(2);
    expect(data.modules.create).toHaveLength(2);
    expect(data.modules.create[0].videos.create).toHaveLength(3);
    expect(data.modules.create[0].quiz.create.questions.create[0].options.create).toHaveLength(2);
    expect(data.modules.create[1].quiz).toBeUndefined();
    expect(database.videoAsset.update).toHaveBeenCalledTimes(1);
    expect(database.videoAsset.update).toHaveBeenCalledWith({
      where: { id: "asset-a" },
      data: { referenceCount: { increment: 2 } },
    });
    expect(changes).toHaveLength(1);
  });

  test("refuses when a draft revision already exists", async () => {
    const { service, database, inAuditScope } = build({ latest: source({ publishedAt: null }) });

    expect(await codeOf(inAuditScope(() => service.clone(courseId)))).toBe(
      "COURSE_REVISION_DRAFT_EXISTS",
    );
    expect(database.courseRevision.create).not.toHaveBeenCalled();
  });

  test("leaves reference counts alone when the copy fails", async () => {
    const { service, database, inAuditScope } = build({ createError: new Error("boom") });

    await failureOf(inAuditScope(() => service.clone(courseId)));

    expect(database.videoAsset.update).not.toHaveBeenCalled();
  });
});

describe("RevisionsService.publish", () => {
  const draft = source({ id: revisionId, publishedAt: null });

  test("publishes the draft when every check passes", async () => {
    const { service, database, changes, inAuditScope } = build({ latest: draft, checks: [[]] });

    const item = await inAuditScope(() => service.publish(courseId, revisionId));

    expect(item.id).toBe(revisionId);
    expect(database.courseRevision.updateMany).toHaveBeenCalledWith({
      where: { id: revisionId, publishedAt: null },
      data: { publishedAt: expect.any(Date) },
    });
    expect(changes).toHaveLength(1);
  });

  test("keeps the draft and lists the failures when a check fails", async () => {
    const { service, database, inAuditScope } = build({
      latest: draft,
      checks: [["Module 1 has no ready video."]],
    });

    const error = await failureOf(inAuditScope(() => service.publish(courseId, revisionId)));

    expect((error as ApiException).code).toBe("COURSE_PUBLISH_CHECKS_FAILED");
    expect((error as ApiException).failures).toEqual(["Module 1 has no ready video."]);
    expect(database.courseRevision.updateMany).not.toHaveBeenCalled();
  });

  test("refuses a revision that is already published", async () => {
    const { service, inAuditScope } = build({ checks: [[]] });

    expect(await codeOf(inAuditScope(() => service.publish(courseId, revisionId)))).toBe(
      "COURSE_REVISION_NOT_DRAFT",
    );
  });

  test("refuses when another request published it first", async () => {
    const { service, inAuditScope } = build({ latest: draft, checks: [[]], updateCount: 0 });

    expect(await codeOf(inAuditScope(() => service.publish(courseId, revisionId)))).toBe(
      "COURSE_REVISION_NOT_DRAFT",
    );
  });

  test("refuses when the course itself is not published", async () => {
    const { service, inAuditScope } = build({ latest: draft, courseStatus: "DRAFT" });

    expect(await codeOf(inAuditScope(() => service.publish(courseId, revisionId)))).toBe(
      "COURSE_NOT_PUBLISHED",
    );
  });

  test("answers not found for a revision of another course", async () => {
    const { service, database, inAuditScope } = build({ latest: draft });
    database.courseRevision.findFirst.mockResolvedValue(null);

    expect(await codeOf(inAuditScope(() => service.publish(courseId, revisionId)))).toBe(
      "NOT_FOUND",
    );
  });
});

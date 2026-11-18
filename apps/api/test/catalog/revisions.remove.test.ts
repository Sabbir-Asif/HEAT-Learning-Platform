import { describe, expect, test, vi } from "vitest";
import { AuditService } from "../../src/audit";
import { auditScopeStorage } from "../../src/audit/audit-scope";
import type { AuditChange } from "../../src/audit";
import { RevisionsService } from "../../src/catalog/revisions.service";
import { ApiException } from "../../src/http/api-exception";

const courseId = "0198f1a0-0000-7000-8000-0000000000c1";
const draftId = "0198f1a0-0000-7000-8000-0000000000e3";
const at = new Date("2026-11-11T06:00:00.000Z");

const build = (
  options: {
    publishedAt?: Date | null;
    enrollments?: number;
    revisions?: number;
    found?: boolean;
    latestId?: string;
  } = {},
) => {
  const database = {
    $queryRaw: vi.fn().mockResolvedValue([{ lockedAt: at }]),
    course: {
      findUnique: vi.fn().mockResolvedValue({
        lockedAt: at,
        revisions: [{ id: options.latestId ?? draftId, publishedAt: options.publishedAt ?? null }],
      }),
    },
    courseRevision: {
      findFirst: vi
        .fn()
        .mockResolvedValueOnce(
          options.found === false
            ? null
            : {
                id: draftId,
                number: 3,
                publishedAt: options.publishedAt ?? null,
                _count: { enrollments: options.enrollments ?? 0 },
                modules: [{ id: "m1" }, { id: "m2" }],
              },
        )
        .mockResolvedValueOnce({
          id: options.latestId ?? draftId,
          publishedAt: options.publishedAt ?? null,
        }),
      count: vi.fn().mockResolvedValue(options.revisions ?? 3),
      delete: vi.fn().mockResolvedValue({}),
    },
    video: {
      findMany: vi.fn().mockResolvedValue([{ assetId: "a" }, { assetId: "a" }, { assetId: "b" }]),
      deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
    },
    videoAsset: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    option: { deleteMany: vi.fn().mockResolvedValue({}) },
    question: { deleteMany: vi.fn().mockResolvedValue({}) },
    quiz: { deleteMany: vi.fn().mockResolvedValue({}) },
    moduleTag: { deleteMany: vi.fn().mockResolvedValue({}) },
    lessonSection: { deleteMany: vi.fn().mockResolvedValue({}) },
    module: { deleteMany: vi.fn().mockResolvedValue({}) },
  };
  const service = new RevisionsService(database as never, new AuditService({} as never), []);
  const changes: AuditChange[] = [];
  const scope = { tx: database as never, changes, afterCommit: [], skipped: false };
  const inAuditScope = <T>(run: () => Promise<T>): Promise<T> => auditScopeStorage.run(scope, run);
  return { service, database, changes, inAuditScope };
};

const codeOf = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
  } catch (error) {
    return error instanceof ApiException ? error.code : error;
  }
  return undefined;
};

describe("RevisionsService.remove", () => {
  test("deletes the draft with its content and releases the video references", async () => {
    const { service, database, changes, inAuditScope } = build();

    await inAuditScope(() => service.remove(courseId, draftId));

    expect(database.videoAsset.updateMany).toHaveBeenCalledWith({
      where: { id: "a", referenceCount: { gte: 2 } },
      data: { referenceCount: { decrement: 2 } },
    });
    expect(database.videoAsset.updateMany).toHaveBeenCalledWith({
      where: { id: "b", referenceCount: { gte: 1 } },
      data: { referenceCount: { decrement: 1 } },
    });
    expect(database.module.deleteMany).toHaveBeenCalledWith({ where: { revisionId: draftId } });
    expect(database.courseRevision.delete).toHaveBeenCalledWith({ where: { id: draftId } });
    expect(changes[0]?.before).toMatchObject({ number: 3, modules: 2 });
  });

  test("refuses a published revision and deletes nothing", async () => {
    const { service, database, inAuditScope } = build({ publishedAt: at });
    expect(await codeOf(inAuditScope(() => service.remove(courseId, draftId)))).toBe(
      "COURSE_REVISION_NOT_DRAFT",
    );
    expect(database.courseRevision.delete).not.toHaveBeenCalled();
  });

  test("refuses when it is not the latest revision", async () => {
    const { service, database, inAuditScope } = build({ latestId: "other" });
    expect(await codeOf(inAuditScope(() => service.remove(courseId, draftId)))).toBe(
      "COURSE_REVISION_NOT_DRAFT",
    );
    expect(database.courseRevision.delete).not.toHaveBeenCalled();
  });

  test("keeps the only revision of a course", async () => {
    const { service, database, inAuditScope } = build({ revisions: 1 });
    expect(await codeOf(inAuditScope(() => service.remove(courseId, draftId)))).toBe(
      "COURSE_REVISION_REQUIRED",
    );
    expect(database.courseRevision.delete).not.toHaveBeenCalled();
  });

  test("answers not found for a revision of another course", async () => {
    const { service, inAuditScope } = build({ found: false });
    expect(await codeOf(inAuditScope(() => service.remove(courseId, draftId)))).toBe("NOT_FOUND");
  });
});

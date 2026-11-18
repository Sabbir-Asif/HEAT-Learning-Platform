import { describe, expect, test, vi } from "vitest";
import { AuditService } from "../../src/audit";
import { auditScopeStorage } from "../../src/audit/audit-scope";
import type { AuditChange } from "../../src/audit";
import { CoursesService } from "../../src/catalog/courses.service";
import { ApiException } from "../../src/http/api-exception";

const id = "0198f1a0-0000-7000-8000-0000000000c1";
const assetId = "0198f1a0-0000-7000-8000-0000000000d1";
const at = new Date("2026-11-11T06:00:00.000Z");

const row = (overrides: Record<string, unknown> = {}) => ({
  id,
  slug: "heat",
  title: "HEAT",
  description: null,
  thumbnailAssetId: null,
  status: "DRAFT",
  lockedAt: null,
  publishedAt: null,
  createdAt: at,
  updatedAt: at,
  _count: { enrollments: 0 },
  revisions: [{ id: "rev", number: 1, publishedAt: null }],
  ...overrides,
});

const request = { title: "HEAT", slug: "heat", description: null, thumbnailAssetId: null };

const build = (
  options: {
    existing?: ReturnType<typeof row> | null;
    taken?: { id: string } | null;
    asset?: { kind: string } | null;
    deletedCount?: number;
    publishedCount?: number;
    createError?: Error;
    checks?: string[][];
  } = {},
) => {
  const database = {
    course: {
      findMany: vi.fn().mockResolvedValue([row()]),
      count: vi.fn().mockResolvedValue(1),
      findUnique: vi
        .fn()
        .mockResolvedValue(options.existing === undefined ? row() : options.existing),
      findFirst: vi.fn().mockResolvedValue(options.taken ?? null),
      create: options.createError
        ? vi.fn().mockRejectedValue(options.createError)
        : vi.fn().mockResolvedValue(row()),
      update: vi.fn().mockResolvedValue(row({ description: "New" })),
      deleteMany: vi.fn().mockResolvedValue({ count: options.deletedCount ?? 1 }),
      updateMany: vi.fn().mockResolvedValue({ count: options.publishedCount ?? 1 }),
    },
    courseRevision: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    mediaAsset: {
      findUnique: vi
        .fn()
        .mockResolvedValue(options.asset === undefined ? { kind: "IMAGE" } : options.asset),
    },
  };
  const checks = (options.checks ?? []).map((failures) => ({
    failures: vi.fn().mockResolvedValue(failures),
  }));
  const revalidate = vi.fn().mockResolvedValue(undefined);
  const service = new CoursesService(
    database as never,
    new AuditService({} as never),
    checks as never,
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

const code = async (promise: Promise<unknown>): Promise<string | undefined> => {
  const error = await failureOf(promise);
  if (error === undefined) return undefined;
  return error instanceof ApiException ? error.code : "OTHER";
};

describe("CoursesService.list", () => {
  test("filters by status and search text and maps the summary", async () => {
    const { service, database } = build();

    const result = await service.list({
      status: "draft",
      page: 2,
      pageSize: 10,
      sort: "-title",
      q: "he",
    });

    expect(database.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "DRAFT",
          OR: [
            { title: { contains: "he", mode: "insensitive" } },
            { slug: { contains: "he", mode: "insensitive" } },
          ],
        },
        skip: 10,
        take: 10,
      }),
    );
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id,
      enrollmentCount: 0,
      currentRevision: { number: 1, publishedAt: null },
    });
  });
});

describe("CoursesService.create", () => {
  test("creates a draft course with revision 1 and records the audit change", async () => {
    const { service, database, changes, inAuditScope } = build();

    const created = await inAuditScope(() => service.create(request));

    expect(database.course.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: "heat", revisions: { create: { number: 1 } } }),
      }),
    );
    expect(created.status).toBe("DRAFT");
    expect(created.currentRevision?.number).toBe(1);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.entityId).toBe(id);
  });

  test("returns the slug conflict code when the slug is taken", async () => {
    const { service, inAuditScope } = build({ taken: { id: "other" } });

    expect(await code(inAuditScope(() => service.create(request)))).toBe("COURSE_SLUG_TAKEN");
  });

  test("returns the slug conflict code when the database reports a unique violation", async () => {
    const { service, inAuditScope } = build({
      createError: Object.assign(new Error("unique"), { code: "P2002" }),
    });

    expect(await code(inAuditScope(() => service.create(request)))).toBe("COURSE_SLUG_TAKEN");
  });

  test("rejects a thumbnail that is not an existing image", async () => {
    for (const asset of [null, { kind: "DOCUMENT" }]) {
      const { service, inAuditScope } = build({ asset });
      const error = await failureOf(
        inAuditScope(() => service.create({ ...request, thumbnailAssetId: assetId })),
      );
      expect(error).toBeInstanceOf(ApiException);
      expect((error as ApiException).fields).toEqual([
        { path: "thumbnailAssetId", code: "invalid" },
      ]);
    }
  });
});

describe("CoursesService.update", () => {
  test("allows a locked course to change description and thumbnail", async () => {
    const { service, database, inAuditScope } = build({ existing: row({ lockedAt: at }) });

    await inAuditScope(() =>
      service.update(id, { ...request, description: "New", thumbnailAssetId: assetId }),
    );

    expect(database.course.update).toHaveBeenCalledTimes(1);
  });

  test("revalidates the front page and the old and new course tags after commit", async () => {
    const { service, database, afterCommit, revalidate, inAuditScope } = build();
    database.course.update.mockResolvedValue(row({ slug: "heat-two" }));

    await inAuditScope(() => service.update(id, { ...request, slug: "heat-two" }));
    expect(revalidate).not.toHaveBeenCalled();
    await afterCommit[0]?.();

    expect(revalidate).toHaveBeenCalledWith(["front-page", "course:heat", "course:heat-two"]);
  });

  test("allows a title change while the latest revision is a draft", async () => {
    const { service, database, inAuditScope } = build({ existing: row({ lockedAt: at }) });

    await inAuditScope(() => service.update(id, { ...request, title: "Other" }));
    expect(database.course.update).toHaveBeenCalled();
  });

  test("refuses a locked course whose title changes", async () => {
    const { service, database, inAuditScope } = build({
      existing: row({
        lockedAt: at,
        revisions: [{ id: "rev", number: 1, publishedAt: at }],
      }),
    });

    expect(await code(inAuditScope(() => service.update(id, { ...request, title: "Other" })))).toBe(
      "COURSE_LOCKED",
    );
    expect(database.course.update).not.toHaveBeenCalled();
  });

  test("reports a missing course and a slug used by another course", async () => {
    expect(await code(build({ existing: null }).service.update(id, request))).toBe("NOT_FOUND");
    const { service } = build({ taken: { id: "other" } });
    expect(await code(service.update(id, request))).toBe("COURSE_SLUG_TAKEN");
  });
});

describe("CoursesService.remove", () => {
  test("soft-deletes a draft course without enrollments and audits it", async () => {
    const { service, database, changes, inAuditScope } = build();

    await inAuditScope(() => service.remove(id));

    expect(database.course.deleteMany).toHaveBeenCalledWith({
      where: { id, status: "DRAFT", enrollments: { none: {} } },
    });
    expect(changes).toHaveLength(1);
  });

  test("refuses a course with an enrollment before deleting", async () => {
    const { service, database, inAuditScope } = build({
      existing: row({ _count: { enrollments: 2 } }),
    });

    expect(await code(inAuditScope(() => service.remove(id)))).toBe("COURSE_HAS_ENROLLMENTS");
    expect(database.course.deleteMany).not.toHaveBeenCalled();
  });

  test("refuses a published course", async () => {
    const { service, inAuditScope } = build({ existing: row({ status: "PUBLISHED" }) });

    expect(await code(inAuditScope(() => service.remove(id)))).toBe("COURSE_NOT_DRAFT");
  });

  test("refuses when an enrollment appears between the check and the delete", async () => {
    const { service, database, inAuditScope } = build({ deletedCount: 0 });
    database.course.findUnique
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(row({ _count: { enrollments: 1 } }));

    expect(await code(inAuditScope(() => service.remove(id)))).toBe("COURSE_HAS_ENROLLMENTS");
  });
});

describe("CoursesService.publish", () => {
  test("publishes a draft course and its draft revision", async () => {
    const { service, database, changes, inAuditScope } = build();
    database.course.findUnique
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(row({ status: "PUBLISHED", publishedAt: at }));

    const published = await inAuditScope(() => service.publish(id));

    expect(published.status).toBe("PUBLISHED");
    expect(database.course.updateMany).toHaveBeenCalledWith({
      where: { id, status: "DRAFT" },
      data: { status: "PUBLISHED", publishedAt: expect.any(Date) },
    });
    expect(database.courseRevision.updateMany).toHaveBeenCalledWith({
      where: { courseId: id, publishedAt: null },
      data: { publishedAt: expect.any(Date) },
    });
    expect(changes).toHaveLength(1);
  });

  test("revalidates the front page and the course tag after commit", async () => {
    const { service, database, afterCommit, revalidate, inAuditScope } = build();
    database.course.findUnique
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(row({ status: "PUBLISHED", publishedAt: at }));

    await inAuditScope(() => service.publish(id));
    await afterCommit[0]?.();

    expect(revalidate).toHaveBeenCalledWith(["front-page", "course:heat"]);
  });

  test("returns every failure from the checks and keeps the course a draft", async () => {
    const { service, database, inAuditScope } = build({
      checks: [["Module 1 has no ready video."], ["Module 2 has no quiz."]],
    });

    const error = await failureOf(inAuditScope(() => service.publish(id)));

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe("COURSE_PUBLISH_CHECKS_FAILED");
    expect((error as ApiException).failures).toEqual([
      "Module 1 has no ready video.",
      "Module 2 has no quiz.",
    ]);
    expect(database.course.updateMany).not.toHaveBeenCalled();
  });

  test("refuses a course that is already published", async () => {
    const { service, inAuditScope } = build({ existing: row({ status: "PUBLISHED" }) });

    expect(await code(inAuditScope(() => service.publish(id)))).toBe("COURSE_NOT_DRAFT");
  });

  test("refuses when another request published it first", async () => {
    const { service, inAuditScope } = build({ publishedCount: 0 });

    expect(await code(inAuditScope(() => service.publish(id)))).toBe("COURSE_NOT_DRAFT");
  });
});

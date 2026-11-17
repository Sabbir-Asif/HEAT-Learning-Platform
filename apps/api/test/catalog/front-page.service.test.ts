import { describe, expect, test, vi } from "vitest";
import { AuditService } from "../../src/audit";
import { auditScopeStorage } from "../../src/audit/audit-scope";
import type { AuditChange } from "../../src/audit";
import { FrontPageService } from "../../src/catalog/front-page.service";

const courseLink = (id: string, status = "PUBLISHED") => ({
  courseId: id,
  course: { slug: `slug-${id}`, title: `Course ${id}`, status },
});

const moduleLink = (id: string, publishedAt: Date | null, status = "PUBLISHED") => ({
  moduleId: id,
  module: {
    id,
    title: `Module ${id}`,
    revision: { publishedAt, courseId: "c1", course: { title: "Course c1", status } },
  },
});

const build = (
  options: {
    courses?: ReturnType<typeof courseLink>[];
    modules?: ReturnType<typeof moduleLink>[];
    images?: Map<string, { assetId: string; url: string; alt: string }>;
  } = {},
) => {
  const database = {
    tag: { findFirst: vi.fn().mockResolvedValue({ id: "front" }) },
    $queryRaw: vi.fn().mockResolvedValue([]),
    courseTag: {
      findMany: vi.fn().mockResolvedValue(options.courses ?? [courseLink("a"), courseLink("b")]),
      update: vi.fn().mockResolvedValue({}),
    },
    moduleTag: {
      findMany: vi.fn().mockResolvedValue(options.modules ?? []),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  const revalidate = vi.fn().mockResolvedValue(undefined);
  const resolveImages = vi.fn().mockResolvedValue(options.images ?? new Map());
  const service = new FrontPageService(
    database as never,
    new AuditService({} as never),
    { revalidate } as never,
    { resolve: resolveImages } as never,
  );
  const changes: AuditChange[] = [];
  const afterCommit: Array<() => Promise<void>> = [];
  const scope = { tx: database as never, changes, afterCommit, skipped: false };
  const inAuditScope = <T>(run: () => Promise<T>): Promise<T> => auditScopeStorage.run(scope, run);
  return { service, database, changes, afterCommit, revalidate, resolveImages, inAuditScope };
};

const failureOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => undefined,
    (error: unknown) => error,
  );

describe("FrontPageService.admin", () => {
  test("marks a module of an unpublished revision as not published", async () => {
    const { service } = build({
      modules: [moduleLink("m1", new Date()), moduleLink("m2", null)],
    });
    const result = await service.admin();
    expect(result.modules.map((module) => module.published)).toEqual([true, false]);
  });
});

describe("FrontPageService.reorderCourses", () => {
  test("stores a dense order, audits it and revalidates after commit", async () => {
    const { service, database, changes, afterCommit, revalidate, inAuditScope } = build();
    await inAuditScope(() =>
      service.reorderCourses({ previousIds: ["a", "b"], orderedIds: ["b", "a"] }),
    );
    expect(database.courseTag.update.mock.calls.map((call) => call[0])).toEqual([
      { where: { courseId_tagId: { courseId: "b", tagId: "front" } }, data: { displayOrder: 1 } },
      { where: { courseId_tagId: { courseId: "a", tagId: "front" } }, data: { displayOrder: 2 } },
    ]);
    expect(changes[0]).toMatchObject({ entityId: "front", after: { courseIds: ["b", "a"] } });
    await afterCommit[0]?.();
    expect(revalidate).toHaveBeenCalledWith(["front-page"]);
  });

  test("refuses a stale order with ORDER_CONFLICT", async () => {
    const { service, database, inAuditScope } = build();
    const error = await failureOf(
      inAuditScope(() =>
        service.reorderCourses({ previousIds: ["b", "a"], orderedIds: ["a", "b"] }),
      ),
    );
    expect(error).toMatchObject({ code: "ORDER_CONFLICT" });
    expect(database.courseTag.update).not.toHaveBeenCalled();
  });
});

describe("FrontPageService.reorderModules", () => {
  test("stores the module order", async () => {
    const { service, database, inAuditScope } = build({
      modules: [moduleLink("x", new Date()), moduleLink("y", new Date())],
    });
    await inAuditScope(() =>
      service.reorderModules({ previousIds: ["x", "y"], orderedIds: ["y", "x"] }),
    );
    expect(database.moduleTag.update).toHaveBeenCalledTimes(2);
  });
});

describe("FrontPageService.public", () => {
  test("queries only published courses and modules of a published revision", async () => {
    const { service, database } = build();
    database.moduleTag.findMany.mockResolvedValue([]);
    await service.public();
    expect(database.courseTag.findMany.mock.calls[0]?.[0].where).toMatchObject({
      tagId: "front",
      course: { deletedAt: null, status: "PUBLISHED" },
    });
    expect(database.moduleTag.findMany.mock.calls[0]?.[0].where).toMatchObject({
      module: {
        deletedAt: null,
        revision: {
          publishedAt: { not: null },
          course: { deletedAt: null, status: "PUBLISHED" },
        },
      },
    });
  });

  test("attaches the resolved thumbnail to each course and null when there is none", async () => {
    const image = { assetId: "t1", url: "/media/public/x/w640.webp", alt: "Cover" };
    const withThumbnail = {
      courseId: "a",
      course: {
        id: "a",
        slug: "a",
        title: "A",
        description: null,
        thumbnailAssetId: "t1",
        status: "PUBLISHED",
      },
    };
    const without = {
      courseId: "b",
      course: {
        id: "b",
        slug: "b",
        title: "B",
        description: null,
        thumbnailAssetId: null,
        status: "PUBLISHED",
      },
    };
    const { service, resolveImages } = build({
      courses: [withThumbnail, without] as never,
      images: new Map([["t1", image]]),
    });

    const result = await service.public();

    expect(resolveImages).toHaveBeenCalledWith(["t1", null]);
    expect(result.courses.map((course) => course.thumbnail)).toEqual([image, null]);
  });
});

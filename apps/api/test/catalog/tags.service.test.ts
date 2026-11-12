import { describe, expect, test, vi } from "vitest";
import { AuditService } from "../../src/audit";
import { auditScopeStorage } from "../../src/audit/audit-scope";
import type { AuditChange } from "../../src/audit";
import { TagsService } from "../../src/catalog/tags.service";

const at = new Date("2026-11-12T06:00:00.000Z");

const tagRow = (overrides: Record<string, unknown> = {}) => ({
  id: "t1",
  slug: "core",
  name: "Core",
  isSystem: false,
  createdAt: at,
  updatedAt: at,
  _count: { courses: 2, modules: 1 },
  courses: [{ course: { id: "c1", title: "Course one" } }],
  modules: [
    {
      module: {
        id: "m1",
        title: "Module one",
        revision: { courseId: "c1", course: { title: "Course one" } },
      },
    },
  ],
  ...overrides,
});

const build = (row: ReturnType<typeof tagRow> | null = tagRow()) => {
  const database = {
    tag: {
      findMany: vi.fn().mockResolvedValue(row === null ? [] : [row]),
      findUnique: vi.fn().mockResolvedValue(row),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(tagRow({ id: "new", slug: "fresh", name: "Fresh" })),
      update: vi.fn().mockResolvedValue(tagRow({ slug: "renamed", name: "Renamed" })),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    courseTag: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
    moduleTag: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  const revalidate = vi.fn().mockResolvedValue(undefined);
  const service = new TagsService(database as never, new AuditService({} as never), {
    revalidate,
  } as never);
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

describe("TagsService.list", () => {
  test("returns the usage counts", async () => {
    const { service } = build();
    const result = await service.list();
    expect(result.items[0]).toMatchObject({ id: "t1", courseCount: 2, moduleCount: 1 });
  });
});

describe("TagsService.get", () => {
  test("names the courses and modules that use the tag", async () => {
    const { service } = build();
    const detail = await service.get("t1");
    expect(detail.courses).toEqual([{ id: "c1", title: "Course one" }]);
    expect(detail.modules).toEqual([
      { id: "m1", title: "Module one", courseId: "c1", courseTitle: "Course one" },
    ]);
  });

  test("answers 404 for an unknown tag", async () => {
    const { service } = build(null);
    expect(await failureOf(service.get("t1"))).toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("TagsService.create", () => {
  test("derives the slug from the name and audits it", async () => {
    const { service, database, changes, inAuditScope } = build();
    await inAuditScope(() => service.create({ name: "Fresh Start" }));
    expect(database.tag.create.mock.calls[0]?.[0].data).toEqual({
      slug: "fresh-start",
      name: "Fresh Start",
    });
    expect(changes[0]?.entityId).toBe("new");
  });

  test("refuses a name whose slug is taken", async () => {
    const { service, database, inAuditScope } = build();
    database.tag.findFirst.mockResolvedValue({ id: "other" });
    const error = await failureOf(inAuditScope(() => service.create({ name: "Core" })));
    expect(error).toMatchObject({ code: "TAG_NAME_TAKEN" });
    expect(database.tag.create).not.toHaveBeenCalled();
  });
});

describe("TagsService.update", () => {
  test("refuses to rename the reserved tag", async () => {
    const { service, database, inAuditScope } = build(tagRow({ isSystem: true }));
    const error = await failureOf(inAuditScope(() => service.update("t1", { name: "Other" })));
    expect(error).toMatchObject({ code: "TAG_RESERVED" });
    expect(database.tag.update).not.toHaveBeenCalled();
  });

  test("renames an ordinary tag and revalidates after commit", async () => {
    const { service, changes, afterCommit, revalidate, inAuditScope } = build();
    await inAuditScope(() => service.update("t1", { name: "Renamed" }));
    expect(changes[0]).toMatchObject({
      before: { slug: "core", name: "Core" },
      after: { slug: "renamed", name: "Renamed" },
    });
    await afterCommit[0]?.();
    expect(revalidate).toHaveBeenCalledWith(["front-page"]);
  });
});

describe("TagsService.remove", () => {
  test("refuses to delete the reserved tag", async () => {
    const { service, database, inAuditScope } = build(tagRow({ isSystem: true }));
    const error = await failureOf(inAuditScope(() => service.remove("t1")));
    expect(error).toMatchObject({ code: "TAG_RESERVED" });
    expect(database.courseTag.deleteMany).not.toHaveBeenCalled();
    expect(database.tag.deleteMany).not.toHaveBeenCalled();
  });

  test("removes the links, frees the slug and audits the usage", async () => {
    const { service, database, changes, inAuditScope } = build();
    await inAuditScope(() => service.remove("t1"));
    expect(database.courseTag.deleteMany).toHaveBeenCalledWith({ where: { tagId: "t1" } });
    expect(database.moduleTag.deleteMany).toHaveBeenCalledWith({ where: { tagId: "t1" } });
    expect(database.tag.update.mock.calls[0]?.[0].data).toEqual({ slug: "core~t1" });
    expect(database.tag.deleteMany).toHaveBeenCalledWith({ where: { id: "t1" } });
    expect(changes[0]).toMatchObject({
      entityId: "t1",
      before: { courseIds: ["c1"], moduleIds: ["m1"] },
    });
  });
});

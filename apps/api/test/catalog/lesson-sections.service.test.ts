import { describe, expect, test, vi } from "vitest";
import { AuditService } from "../../src/audit";
import { auditScopeStorage } from "../../src/audit/audit-scope";
import type { AuditChange } from "../../src/audit";
import { LessonSectionsService } from "../../src/catalog/lesson-sections.service";

const courseId = "0198f1a0-0000-7000-8000-0000000000c1";
const at = new Date("2026-11-11T06:00:00.000Z");

const sectionRow = (id: string, order: number) => ({ id, order, title: `Section ${id}` });

const moduleRow = (sections: Array<ReturnType<typeof sectionRow>>) => ({
  id: "m",
  order: 1,
  title: "Module",
  objectives: [],
  createdAt: at,
  updatedAt: at,
  lessonSections: sections,
});

const build = (options: { lockedAt?: Date | null } = {}) => {
  const sections = [sectionRow("a", 1), sectionRow("b", 2), sectionRow("c", 3)];
  const calls: string[] = [];
  const database = {
    $queryRaw: vi.fn().mockResolvedValue([{ lockedAt: options.lockedAt ?? null }]),
    course: {
      findUnique: vi.fn().mockResolvedValue({
        lockedAt: options.lockedAt ?? null,
        revisions: [{ id: "rev" }],
      }),
    },
    module: {
      findFirst: vi
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) =>
          Promise.resolve(where.id === "m" ? moduleRow(sections) : null),
        ),
    },
    lessonSection: {
      findMany: vi.fn().mockResolvedValue(sections.map(({ id }) => ({ id }))),
      findFirst: vi
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) =>
          Promise.resolve(sections.find((item) => item.id === where.id) ?? null),
        ),
      aggregate: vi.fn().mockResolvedValue({ _max: { order: 3 } }),
      create: vi.fn().mockResolvedValue(sectionRow("n", 4)),
      update: vi
        .fn()
        .mockImplementation(
          ({
            where,
            data,
          }: {
            where: { id: string };
            data: { order?: number; title?: string };
          }) => {
            calls.push(`${where.id}:${String(data.order)}`);
            return Promise.resolve(sectionRow(where.id, data.order ?? 1));
          },
        ),
      delete: vi.fn().mockResolvedValue({}),
    },
  };
  const service = new LessonSectionsService(database as never, new AuditService({} as never), {
    describe: vi.fn(),
  } as never);
  const changes: AuditChange[] = [];
  const scope = { tx: database as never, changes, afterCommit: [], skipped: false };
  const inAuditScope = <T>(run: () => Promise<T>): Promise<T> => auditScopeStorage.run(scope, run);
  return { service, database, changes, calls, inAuditScope };
};

const failureOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => undefined,
    (error: unknown) => error,
  );

describe("LessonSectionsService.create", () => {
  test("appends a section with an empty body", async () => {
    const { service, database, changes, inAuditScope } = build();
    await inAuditScope(() => service.create(courseId, "m", { title: "Intro" }));
    expect(database.lessonSection.create.mock.calls[0]?.[0].data).toMatchObject({
      moduleId: "m",
      order: 4,
      title: "Intro",
      body: { type: "doc", content: [] },
      schemaVersion: 1,
    });
    expect(changes[0]?.entityId).toBe("n");
  });

  test("is refused with CONTENT_LOCKED on a locked course", async () => {
    const { service, database, inAuditScope } = build({ lockedAt: at });
    expect(
      await failureOf(inAuditScope(() => service.create(courseId, "m", { title: "Intro" }))),
    ).toMatchObject({ code: "CONTENT_LOCKED" });
    expect(database.lessonSection.create).not.toHaveBeenCalled();
  });

  test("answers 404 for a module outside the course", async () => {
    const { service, inAuditScope } = build();
    expect(
      await failureOf(inAuditScope(() => service.create(courseId, "x", { title: "Intro" }))),
    ).toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("LessonSectionsService.update", () => {
  test("renames a section and audits before and after", async () => {
    const { service, changes, inAuditScope } = build();
    await inAuditScope(() => service.update(courseId, "m", "a", { title: "Renamed" }));
    expect(changes[0]).toMatchObject({ entityId: "a", before: { title: "Section a" } });
  });

  test("allows a wording fix on a locked course", async () => {
    const { service, inAuditScope } = build({ lockedAt: at });
    await expect(
      inAuditScope(() => service.update(courseId, "m", "a", { title: "Fix" })),
    ).resolves.toBeDefined();
  });

  test("answers 404 for an unknown section", async () => {
    const { service, inAuditScope } = build();
    expect(
      await failureOf(inAuditScope(() => service.update(courseId, "m", "zzz", { title: "x" }))),
    ).toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("LessonSectionsService.remove", () => {
  test("deletes the section and closes the gap", async () => {
    const { service, database, calls, inAuditScope } = build();
    database.lessonSection.findMany.mockResolvedValue([{ id: "b" }, { id: "c" }]);
    await inAuditScope(() => service.remove(courseId, "m", "a"));
    expect(database.lessonSection.delete).toHaveBeenCalledWith({ where: { id: "a" } });
    expect(calls.filter((call) => !call.includes(":-"))).toEqual(["b:1", "c:2"]);
  });

  test("is refused with CONTENT_LOCKED on a locked course", async () => {
    const { service, database, inAuditScope } = build({ lockedAt: at });
    expect(await failureOf(inAuditScope(() => service.remove(courseId, "m", "a")))).toMatchObject({
      code: "CONTENT_LOCKED",
    });
    expect(database.lessonSection.delete).not.toHaveBeenCalled();
  });
});

describe("LessonSectionsService.reorder", () => {
  test("renumbers through negative orders so no duplicate exists at any step", async () => {
    const { service, calls, inAuditScope } = build();
    await inAuditScope(() =>
      service.reorder(courseId, "m", { previousIds: ["a", "b", "c"], orderedIds: ["c", "a", "b"] }),
    );
    expect(calls).toEqual(["c:-1", "a:-2", "b:-3", "c:1", "a:2", "b:3"]);
  });

  test("answers ORDER_CONFLICT when another admin reordered first", async () => {
    const { service, calls, inAuditScope } = build();
    expect(
      await failureOf(
        inAuditScope(() =>
          service.reorder(courseId, "m", {
            previousIds: ["b", "a", "c"],
            orderedIds: ["c", "a", "b"],
          }),
        ),
      ),
    ).toMatchObject({ code: "ORDER_CONFLICT" });
    expect(calls).toEqual([]);
  });

  test("is refused with CONTENT_LOCKED on a locked course", async () => {
    const { service, inAuditScope } = build({ lockedAt: at });
    expect(
      await failureOf(
        inAuditScope(() =>
          service.reorder(courseId, "m", {
            previousIds: ["a", "b", "c"],
            orderedIds: ["c", "a", "b"],
          }),
        ),
      ),
    ).toMatchObject({ code: "CONTENT_LOCKED" });
  });
});

import { describe, expect, test, vi } from "vitest";
import { AuditService } from "../../src/audit";
import { auditScopeStorage } from "../../src/audit/audit-scope";
import type { AuditChange } from "../../src/audit";
import { ModulesService } from "../../src/catalog/modules.service";
import { ApiException } from "../../src/http/api-exception";

const courseId = "0198f1a0-0000-7000-8000-0000000000c1";
const at = new Date("2026-11-11T06:00:00.000Z");

const moduleRow = (id: string, order: number, overrides: Record<string, unknown> = {}) => ({
  id,
  order,
  title: `Module ${id}`,
  objectives: [],
  createdAt: at,
  updatedAt: at,
  lessonSections: [],
  ...overrides,
});

const build = (
  options: {
    lockedAt?: Date | null;
    modules?: ReturnType<typeof moduleRow>[];
    quiz?: boolean;
  } = {},
) => {
  const modules = options.modules ?? [moduleRow("a", 1), moduleRow("b", 2), moduleRow("c", 3)];
  const calls: string[] = [];
  const database = {
    $queryRaw: vi
      .fn()
      .mockResolvedValue([{ lockedAt: options.lockedAt ?? null, highest: modules.length }]),
    course: {
      findUnique: vi.fn().mockResolvedValue({
        slug: "heat",
        lockedAt: options.lockedAt ?? null,
        revisions: [{ id: "rev" }],
      }),
    },
    module: {
      findMany: vi.fn().mockResolvedValue(modules),
      findFirst: vi
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) =>
          Promise.resolve(modules.find((item: { id: string }) => item.id === where.id) ?? null),
        ),
      create: vi.fn().mockResolvedValue(moduleRow("n", modules.length + 1)),
      update: vi
        .fn()
        .mockImplementation(
          ({ where, data }: { where: { id: string }; data: { order?: number } }) => {
            calls.push(`${where.id}:${String(data.order)}`);
            return Promise.resolve(moduleRow(where.id, data.order ?? 1));
          },
        ),
      delete: vi.fn().mockResolvedValue({}),
    },
    quiz: {
      findUnique: vi.fn().mockResolvedValue(options.quiz ? { id: "q" } : null),
      delete: vi.fn().mockResolvedValue({}),
    },
    option: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    question: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    video: {
      findMany: vi.fn().mockResolvedValue([{ assetId: "asset-1" }]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    videoAsset: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    moduleTag: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    lessonSection: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
  const revalidate = vi.fn().mockResolvedValue(undefined);
  const service = new ModulesService(database as never, new AuditService({} as never), {
    revalidate,
  } as never);
  const changes: AuditChange[] = [];
  const afterCommit: Array<() => Promise<void>> = [];
  const scope = { tx: database as never, changes, afterCommit, skipped: false };
  const inAuditScope = <T>(run: () => Promise<T>): Promise<T> => auditScopeStorage.run(scope, run);
  return { service, database, changes, calls, afterCommit, revalidate, inAuditScope };
};

const failureOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => undefined,
    (error: unknown) => error,
  );

describe("ModulesService.list", () => {
  test("returns the modules in order with the lock flag", async () => {
    const { service } = build({ lockedAt: at });
    const result = await service.list(courseId);
    expect(result.items.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(result.locked).toBe(true);
  });

  test("answers 404 for an unknown course", async () => {
    const { service, database } = build();
    database.course.findUnique.mockResolvedValue(null);
    expect(await failureOf(service.list(courseId))).toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("ModulesService.create", () => {
  test("appends after the highest order and audits it", async () => {
    const { service, database, changes, inAuditScope } = build();
    await inAuditScope(() => service.create(courseId, { title: "New", objectives: ["Know"] }));
    expect(database.module.create.mock.calls[0]?.[0].data).toMatchObject({
      revisionId: "rev",
      order: 4,
      title: "New",
      objectives: ["Know"],
    });
    expect(changes[0]?.entityId).toBe("n");
  });

  test("revalidates the front page and the course tag after commit", async () => {
    const { service, afterCommit, revalidate, inAuditScope } = build();

    await inAuditScope(() => service.create(courseId, { title: "New", objectives: [] }));
    await afterCommit[0]?.();

    expect(revalidate).toHaveBeenCalledWith(["front-page", "course:heat"]);
  });

  test("is refused with CONTENT_LOCKED on a locked course", async () => {
    const { service, database, inAuditScope } = build({ lockedAt: at });
    const error = await failureOf(
      inAuditScope(() => service.create(courseId, { title: "N", objectives: [] })),
    );
    expect(error).toMatchObject({ code: "CONTENT_LOCKED" });
    expect(database.module.create).not.toHaveBeenCalled();
  });
});

describe("ModulesService.update", () => {
  test("changes the title and objectives and audits before and after", async () => {
    const { service, database, changes, inAuditScope } = build();
    database.module.update.mockResolvedValue(moduleRow("a", 1, { title: "Renamed" }));
    const result = await inAuditScope(() =>
      service.update(courseId, "a", { title: "Renamed", objectives: [] }),
    );
    expect(result.title).toBe("Renamed");
    expect(changes[0]).toMatchObject({ entityId: "a", before: { title: "Module a" } });
  });

  test("allows wording fixes on a locked course", async () => {
    const { service, inAuditScope } = build({ lockedAt: at });
    await expect(
      inAuditScope(() => service.update(courseId, "a", { title: "Fix", objectives: [] })),
    ).resolves.toBeDefined();
  });

  test("refuses a changed number of objectives on a locked course", async () => {
    const { service, database, inAuditScope } = build({
      lockedAt: at,
      modules: [moduleRow("a", 1, { objectives: ["One"] })],
    });
    expect(
      await failureOf(
        inAuditScope(() =>
          service.update(courseId, "a", { title: "Module a", objectives: ["One", "Two"] }),
        ),
      ),
    ).toMatchObject({ code: "CONTENT_LOCKED" });
    expect(database.module.update).not.toHaveBeenCalled();
  });

  test("answers 404 for a module of another course", async () => {
    const { service, inAuditScope } = build();
    expect(
      await failureOf(
        inAuditScope(() => service.update(courseId, "zzz", { title: "x", objectives: [] })),
      ),
    ).toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("ModulesService.remove", () => {
  test("drops the reference count of each video asset in the module", async () => {
    const { service, database, inAuditScope } = build();
    await inAuditScope(() => service.remove(courseId, "a"));
    expect(database.videoAsset.updateMany).toHaveBeenCalledWith({
      where: { id: "asset-1", referenceCount: { gt: 0 } },
      data: { referenceCount: { decrement: 1 } },
    });
  });

  test("removes sections, videos, tags and the quiz with the module, then closes the gap", async () => {
    const { service, database, calls, inAuditScope } = build({ quiz: true });
    database.module.findMany.mockResolvedValue([moduleRow("b", 2), moduleRow("c", 3)]);
    await inAuditScope(() => service.remove(courseId, "a"));
    expect(database.lessonSection.deleteMany).toHaveBeenCalledWith({ where: { moduleId: "a" } });
    expect(database.video.deleteMany).toHaveBeenCalledWith({ where: { moduleId: "a" } });
    expect(database.moduleTag.deleteMany).toHaveBeenCalledWith({ where: { moduleId: "a" } });
    expect(database.option.deleteMany).toHaveBeenCalled();
    expect(database.question.deleteMany).toHaveBeenCalled();
    expect(database.quiz.delete).toHaveBeenCalled();
    expect(database.module.delete).toHaveBeenCalledWith({ where: { id: "a" } });
    expect(calls.filter((call) => !call.includes(":-"))).toEqual(["b:1", "c:2"]);
  });

  test("is refused with CONTENT_LOCKED on a locked course", async () => {
    const { service, database, inAuditScope } = build({ lockedAt: at });
    expect(await failureOf(inAuditScope(() => service.remove(courseId, "a")))).toMatchObject({
      code: "CONTENT_LOCKED",
    });
    expect(database.module.delete).not.toHaveBeenCalled();
  });
});

describe("ModulesService.reorder", () => {
  test("parks every module on a negative order before giving the final order", async () => {
    const { service, calls, inAuditScope } = build();
    await inAuditScope(() =>
      service.reorder(courseId, { previousIds: ["a", "b", "c"], orderedIds: ["c", "a", "b"] }),
    );
    expect(calls).toEqual(["c:-1", "a:-2", "b:-3", "c:1", "a:2", "b:3"]);
  });

  test("answers ORDER_CONFLICT when the stored order moved on", async () => {
    const { service, calls, inAuditScope } = build();
    const error = await failureOf(
      inAuditScope(() =>
        service.reorder(courseId, { previousIds: ["b", "a", "c"], orderedIds: ["c", "a", "b"] }),
      ),
    );
    expect(error).toMatchObject({ code: "ORDER_CONFLICT" });
    expect(calls).toEqual([]);
  });

  test("is refused with CONTENT_LOCKED on a locked course", async () => {
    const { service, inAuditScope } = build({ lockedAt: at });
    const error = await failureOf(
      inAuditScope(() =>
        service.reorder(courseId, { previousIds: ["a", "b", "c"], orderedIds: ["c", "a", "b"] }),
      ),
    );
    expect(error).toBeInstanceOf(ApiException);
    expect(error).toMatchObject({ code: "CONTENT_LOCKED" });
  });

  test("locks the course row before reading the current order", async () => {
    const { service, database, inAuditScope } = build();
    await inAuditScope(() =>
      service.reorder(courseId, { previousIds: ["a", "b", "c"], orderedIds: ["a", "b", "c"] }),
    );
    expect(database.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      database.module.findMany.mock.invocationCallOrder[0] ?? 0,
    );
  });
});

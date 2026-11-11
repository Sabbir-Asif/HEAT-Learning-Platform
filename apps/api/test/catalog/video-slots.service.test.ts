import { describe, expect, test, vi } from "vitest";
import { AuditService } from "../../src/audit";
import { auditScopeStorage } from "../../src/audit/audit-scope";
import type { AuditChange } from "../../src/audit";
import { VideoSlotsService } from "../../src/catalog/video-slots.service";

const courseId = "0198f1a0-0000-7000-8000-0000000000c1";
const at = new Date("2026-11-11T06:00:00.000Z");

interface SlotFixture {
  id: string;
  order: number;
  title: string;
  required: boolean;
  assetId: string | null;
  asset: { status: string; assetKey: string; rejectionReason?: string | null;
    failureReason?: string | null;
  } | null;
}

const slot = (id: string, order: number, overrides: Partial<SlotFixture> = {}): SlotFixture => ({
  id,
  order,
  title: `Video ${id}`,
  required: true,
  assetId: null,
  asset: null,
  ...overrides,
});

const build = (options: { lockedAt?: Date | null; slots?: SlotFixture[] } = {}) => {
  const slots = options.slots ?? [slot("a", 1), slot("b", 2), slot("c", 3)];
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
          Promise.resolve(where.id === "m" ? { id: "m" } : null),
        ),
    },
    video: {
      findMany: vi
        .fn()
        .mockImplementation(({ select }: { select: Record<string, unknown> }) =>
          Promise.resolve(select.title === undefined ? slots.map(({ id }) => ({ id })) : slots),
        ),
      findFirst: vi
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) =>
          Promise.resolve(slots.find((item) => item.id === where.id) ?? null),
        ),
      aggregate: vi.fn().mockResolvedValue({ _max: { order: 3 } }),
      create: vi.fn().mockResolvedValue(slot("n", 4)),
      update: vi
        .fn()
        .mockImplementation(
          ({
            where,
            data,
          }: {
            where: { id: string };
            data: { order?: number; title?: string; required?: boolean };
          }) => {
            calls.push(`${where.id}:${String(data.order)}`);
            return Promise.resolve(slot(where.id, data.order ?? 1, data));
          },
        ),
      delete: vi.fn().mockResolvedValue({}),
    },
    videoAsset: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      delete: vi.fn(),
    },
  };
  const service = new VideoSlotsService(database as never, new AuditService({} as never));
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

describe("VideoSlotsService.list rejection reason", () => {
  test("shows why a rejected video was refused and null otherwise", async () => {
    const { service } = build({
      slots: [
        slot("a", 1, {
          assetId: "x",
          asset: { status: "REJECTED", assetKey: "k1", rejectionReason: "UNSUPPORTED_CODEC" },
        }),
        slot("b", 2, { assetId: "y", asset: { status: "READY", assetKey: "k2" } }),
        slot("c", 3),
      ],
    });
    const result = await service.list(courseId, "m");
    expect(result.items.map((item) => item.rejectionReason)).toEqual([
      "UNSUPPORTED_CODEC",
      null,
      null,
    ]);
  });
});

describe("VideoSlotsService.list failure reason", () => {
  test("shows why processing failed, and null for unknown or missing reasons", async () => {
    const { service } = build({
      slots: [
        slot("a", 1, {
          assetId: "x",
          asset: { status: "FAILED", assetKey: "k1", failureReason: "TIMED_OUT" },
        }),
        slot("b", 2, {
          assetId: "y",
          asset: { status: "FAILED", assetKey: "k2", failureReason: "legacy" },
        }),
        slot("c", 3, { assetId: "z", asset: { status: "READY", assetKey: "k3" } }),
      ],
    });
    const result = await service.list(courseId, "m");
    expect(result.items.map((item) => item.failureReason)).toEqual(["TIMED_OUT", null, null]);
  });
});

describe("VideoSlotsService.list", () => {
  test("returns the slots in order with their status and no disk path", async () => {
    const { service, database } = build({
      slots: [
        slot("a", 1),
        slot("b", 2, { assetId: "x", asset: { status: "READY", assetKey: "key-1" } }),
      ],
    });
    const result = await service.list(courseId, "m");
    expect(database.video.findMany.mock.calls[0]?.[0].orderBy).toEqual({ order: "asc" });
    expect(
      result.items.map(({ order, status, assetKey }) => ({ order, status, assetKey })),
    ).toEqual([
      { order: 1, status: "NOT_UPLOADED", assetKey: null },
      { order: 2, status: "READY", assetKey: "key-1" },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/path|\/var|\/srv/i);
    expect(result.locked).toBe(false);
  });

  test("reports a locked course", async () => {
    const { service } = build({ lockedAt: at });
    expect((await service.list(courseId, "m")).locked).toBe(true);
  });

  test("answers 404 for a module outside the course", async () => {
    const { service } = build();
    expect(await failureOf(service.list(courseId, "x"))).toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("VideoSlotsService.create", () => {
  test("adds a slot with the next order and no asset", async () => {
    const { service, database, changes, inAuditScope } = build();
    await inAuditScope(() => service.create(courseId, "m", { title: "Intro", required: false }));
    expect(database.video.create.mock.calls[0]?.[0].data).toEqual({
      moduleId: "m",
      order: 4,
      title: "Intro",
      required: false,
    });
    expect(changes[0]?.entityId).toBe("n");
  });

  test("starts at order 1 in an empty module", async () => {
    const { service, database, inAuditScope } = build({ slots: [] });
    database.video.aggregate.mockResolvedValue({ _max: { order: null } });
    await inAuditScope(() => service.create(courseId, "m", { title: "Intro", required: true }));
    expect(database.video.create.mock.calls[0]?.[0].data.order).toBe(1);
  });

  test("is refused with CONTENT_LOCKED on a locked course", async () => {
    const { service, database, inAuditScope } = build({ lockedAt: at });
    expect(
      await failureOf(
        inAuditScope(() => service.create(courseId, "m", { title: "Intro", required: true })),
      ),
    ).toMatchObject({ code: "CONTENT_LOCKED" });
    expect(database.video.create).not.toHaveBeenCalled();
  });
});

describe("VideoSlotsService.update", () => {
  test("changes the title and flag and audits before and after", async () => {
    const { service, changes, inAuditScope } = build();
    await inAuditScope(() => service.update(courseId, "m", "a", { title: "New", required: false }));
    expect(changes[0]).toMatchObject({
      entityId: "a",
      before: { required: true },
      after: { required: false, title: "New" },
    });
  });

  test("allows a wording fix on a locked course", async () => {
    const { service, inAuditScope } = build({ lockedAt: at });
    await expect(
      inAuditScope(() => service.update(courseId, "m", "a", { title: "Fix", required: true })),
    ).resolves.toBeDefined();
  });

  test("refuses a required flag change on a locked course", async () => {
    const { service, database, inAuditScope } = build({ lockedAt: at });
    expect(
      await failureOf(
        inAuditScope(() => service.update(courseId, "m", "a", { title: "Fix", required: false })),
      ),
    ).toMatchObject({ code: "CONTENT_LOCKED" });
    expect(database.video.update).not.toHaveBeenCalled();
  });

  test("answers 404 for an unknown slot", async () => {
    const { service, inAuditScope } = build();
    expect(
      await failureOf(
        inAuditScope(() => service.update(courseId, "m", "zzz", { title: "x", required: true })),
      ),
    ).toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("VideoSlotsService.remove", () => {
  test("deletes the slot and closes the gap", async () => {
    const { service, database, calls, inAuditScope } = build();
    database.video.findMany.mockResolvedValue([slot("b", 2), slot("c", 3)]);
    await inAuditScope(() => service.remove(courseId, "m", "a"));
    expect(database.video.delete).toHaveBeenCalledWith({ where: { id: "a" } });
    expect(calls.filter((call) => !call.includes(":-"))).toEqual(["b:1", "c:2"]);
  });

  test("drops the asset reference count and never deletes the asset", async () => {
    const { service, database, inAuditScope } = build({
      slots: [slot("a", 1, { assetId: "asset-1", asset: { status: "READY", assetKey: "k" } })],
    });
    database.video.findMany.mockResolvedValue([]);
    await inAuditScope(() => service.remove(courseId, "m", "a"));
    expect(database.videoAsset.updateMany).toHaveBeenCalledWith({
      where: { id: "asset-1", referenceCount: { gt: 0 } },
      data: { referenceCount: { decrement: 1 } },
    });
    expect(database.videoAsset.delete).not.toHaveBeenCalled();
  });

  test("leaves assets alone for a slot without one", async () => {
    const { service, database, inAuditScope } = build();
    database.video.findMany.mockResolvedValue([]);
    await inAuditScope(() => service.remove(courseId, "m", "a"));
    expect(database.videoAsset.updateMany).not.toHaveBeenCalled();
  });

  test("is refused with CONTENT_LOCKED on a locked course", async () => {
    const { service, database, inAuditScope } = build({ lockedAt: at });
    expect(await failureOf(inAuditScope(() => service.remove(courseId, "m", "a")))).toMatchObject({
      code: "CONTENT_LOCKED",
    });
    expect(database.video.delete).not.toHaveBeenCalled();
  });
});

describe("VideoSlotsService.reorder", () => {
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

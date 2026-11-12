import { describe, expect, test, vi } from "vitest";
import { ApiException } from "../../src/http/api-exception";
import {
  NotificationsService,
  notificationRetentionDays,
} from "../../src/notifications/notifications.service";

const now = new Date("2026-11-12T05:00:00.000Z");

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "n1",
  type: "ENROLLMENT_APPROVED",
  data: { courseId: "c1" },
  readAt: null,
  createdAt: new Date("2026-11-10T00:00:00.000Z"),
  ...overrides,
});

const build = () => {
  const database = {
    notification: {
      findMany: vi.fn().mockResolvedValue([row()]),
      count: vi.fn().mockResolvedValue(7),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  return { service: new NotificationsService(database as never, { now: () => now }), database };
};

const transaction = (overrides: { userExists?: boolean; audience?: string[] } = {}) => ({
  user: { count: vi.fn().mockResolvedValue(overrides.userExists === false ? 0 : 1) },
  enrollment: {
    findMany: vi.fn().mockResolvedValue((overrides.audience ?? []).map((userId) => ({ userId }))),
  },
  notification: {
    create: vi.fn().mockResolvedValue({}),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
});

describe("NotificationsService.createWithin", () => {
  test("creates one notification on the given transaction", async () => {
    const { service } = build();
    const tx = transaction();

    const created = await service.createWithin(tx as never, {
      userId: "u1",
      type: "ENROLLMENT_APPROVED",
      data: { courseId: "c1" },
    });

    expect(created).toBe(true);
    expect(tx.notification.create).toHaveBeenCalledTimes(1);
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: { userId: "u1", type: "ENROLLMENT_APPROVED", data: { courseId: "c1" } },
    });
  });

  test("creates nothing for a deleted account", async () => {
    const { service } = build();
    const tx = transaction({ userExists: false });

    const created = await service.createWithin(tx as never, {
      userId: "u1",
      type: "ENROLLMENT_REJECTED",
      data: {},
    });

    expect(created).toBe(false);
    expect(tx.user.count).toHaveBeenCalledWith({ where: { id: "u1", deletedAt: null } });
    expect(tx.notification.create).not.toHaveBeenCalled();
  });
});

describe("NotificationsService.createForApprovedStudents", () => {
  test("creates one entry per approved or completed student and nothing else", async () => {
    const { service } = build();
    const tx = transaction({ audience: ["u1", "u2"] });

    const count = await service.createForApprovedStudents(tx as never, "NEWS_PUBLISHED", {
      newsPostId: "p1",
    });

    expect(count).toBe(2);
    expect(tx.enrollment.findMany).toHaveBeenCalledWith({
      where: {
        status: { in: ["APPROVED", "COMPLETED"] },
        deletedAt: null,
        user: { deletedAt: null },
      },
      select: { userId: true },
      distinct: ["userId"],
    });
    expect(tx.notification.createMany).toHaveBeenCalledWith({
      data: [
        { userId: "u1", type: "NEWS_PUBLISHED", data: { newsPostId: "p1" } },
        { userId: "u2", type: "NEWS_PUBLISHED", data: { newsPostId: "p1" } },
      ],
    });
  });

  test("writes nothing when nobody qualifies", async () => {
    const { service } = build();
    const tx = transaction({ audience: [] });

    expect(await service.createForApprovedStudents(tx as never, "NEWS_PUBLISHED", {})).toBe(0);
    expect(tx.notification.createMany).not.toHaveBeenCalled();
  });
});

describe("NotificationsService.list", () => {
  test("returns only the user's rows, newest first, with the page window", async () => {
    const { service, database } = build();

    const result = await service.list("u1", { page: 2, pageSize: 20 });

    expect(database.notification.findMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: 20,
      take: 20,
      select: { id: true, type: true, data: true, readAt: true, createdAt: true },
    });
    expect(database.notification.count).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(result).toEqual({
      items: [
        {
          id: "n1",
          type: "ENROLLMENT_APPROVED",
          data: { courseId: "c1" },
          readAt: null,
          createdAt: "2026-11-10T00:00:00.000Z",
        },
      ],
      total: 7,
      page: 2,
      pageSize: 20,
    });
  });
});

describe("NotificationsService.unreadCount", () => {
  test("counts the user's unread rows", async () => {
    const { service, database } = build();

    expect(await service.unreadCount("u1")).toEqual({ count: 7 });
    expect(database.notification.count).toHaveBeenCalledWith({
      where: { userId: "u1", readAt: null },
    });
  });
});

describe("NotificationsService.markRead", () => {
  test("marks an unread notification of the user as read", async () => {
    const { service, database } = build();
    database.notification.updateMany.mockResolvedValue({ count: 1 });
    database.notification.findFirst.mockResolvedValue(row({ readAt: now }));

    const result = await service.markRead("u1", "n1");

    expect(database.notification.updateMany).toHaveBeenCalledWith({
      where: { id: "n1", userId: "u1", readAt: null },
      data: { readAt: now },
    });
    expect(result.readAt).toBe(now.toISOString());
  });

  test("is idempotent for a notification that is already read", async () => {
    const { service, database } = build();
    const earlier = new Date("2026-11-11T00:00:00.000Z");
    database.notification.updateMany.mockResolvedValue({ count: 0 });
    database.notification.findFirst.mockResolvedValue(row({ readAt: earlier }));

    const result = await service.markRead("u1", "n1");

    expect(result.readAt).toBe(earlier.toISOString());
    expect(database.notification.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "n1", userId: "u1" } }),
    );
  });

  test("answers 404 for another user's notification and changes nothing", async () => {
    const { service, database } = build();
    database.notification.updateMany.mockResolvedValue({ count: 0 });
    database.notification.findFirst.mockResolvedValue(null);

    const failure = await service.markRead("u1", "n9").catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiException);
    expect((failure as ApiException).getStatus()).toBe(404);
    expect(database.notification.updateMany).toHaveBeenCalledWith({
      where: { id: "n9", userId: "u1", readAt: null },
      data: { readAt: now },
    });
  });
});

describe("NotificationsService.markAllRead", () => {
  test("marks only the user's unread rows", async () => {
    const { service, database } = build();
    database.notification.updateMany.mockResolvedValue({ count: 4 });

    expect(await service.markAllRead("u1")).toEqual({ updated: 4 });
    expect(database.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", readAt: null },
      data: { readAt: now },
    });
  });
});

describe("NotificationsService.purgeReadOlderThanRetention", () => {
  test("deletes read notifications created more than 180 days ago", async () => {
    const { service, database } = build();
    database.notification.deleteMany.mockResolvedValue({ count: 3 });

    const removed = await service.purgeReadOlderThanRetention();

    const cutoff = new Date(now.getTime() - notificationRetentionDays * 24 * 60 * 60 * 1000);
    expect(notificationRetentionDays).toBe(180);
    expect(removed).toBe(3);
    expect(database.notification.deleteMany).toHaveBeenCalledWith({
      where: { readAt: { not: null }, createdAt: { lt: cutoff } },
    });
  });
});

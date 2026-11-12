import { describe, expect, test, vi } from "vitest";
import { AUDIENCE_KEY } from "../../src/access/access.decorators";
import { NotificationsController } from "../../src/notifications/notifications.controller";

const session = { userId: "u1" } as never;

const build = () => {
  const service = {
    list: vi.fn().mockResolvedValue({ items: [] }),
    unreadCount: vi.fn().mockResolvedValue({ count: 2 }),
    markRead: vi.fn().mockResolvedValue({ id: "n1" }),
    markAllRead: vi.fn().mockResolvedValue({ updated: 1 }),
  };
  return { service, controller: new NotificationsController(service as never) };
};

describe("NotificationsController", () => {
  test("is limited to the student audience", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, NotificationsController)).toBe("student");
  });

  test("scopes every call to the signed-in user", async () => {
    const { controller, service } = build();

    await controller.list(session, { page: 1, pageSize: 20 });
    await controller.unreadCount(session);
    await controller.markRead(session, "n1");
    await controller.markAllRead(session);

    expect(service.list).toHaveBeenCalledWith("u1", { page: 1, pageSize: 20 });
    expect(service.unreadCount).toHaveBeenCalledWith("u1");
    expect(service.markRead).toHaveBeenCalledWith("u1", "n1");
    expect(service.markAllRead).toHaveBeenCalledWith("u1");
  });

  test("never lets shared caches keep reads", () => {
    for (const method of [
      NotificationsController.prototype.list,
      NotificationsController.prototype.unreadCount,
    ]) {
      expect(Reflect.getMetadata("__headers__", method)).toContainEqual({
        name: "Cache-Control",
        value: "no-store",
      });
    }
  });
});

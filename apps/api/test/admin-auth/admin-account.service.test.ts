import { describe, expect, test, vi } from "vitest";
import { AdminAccountService } from "../../src/admin-auth/admin-account.service";

const actor = { actorId: "admin-id", ipAddress: "127.0.0.1", requestId: "r" };

const build = (transaction: () => Promise<void>) => {
  const order: string[] = [];
  const database = {
    user: { findFirst: vi.fn().mockResolvedValue({ passwordHash: "old" }) },
    $transaction: vi.fn(async () => {
      order.push("transaction");
      await transaction();
    }),
  };
  const sessions = {
    revokeAllExceptCurrent: vi.fn(async () => {
      order.push("revoke");
    }),
  };
  const passwords = {
    verify: vi.fn().mockResolvedValue(true),
    hashChecked: vi.fn().mockResolvedValue("new"),
  };
  const service = new AdminAccountService(
    database as never,
    passwords as never,
    sessions as never,
    {} as never,
  );
  return { service, sessions, order };
};

describe("AdminAccountService.changePassword", () => {
  test("revokes the other sessions before the password and audit transaction", async () => {
    const { service, order } = build(async () => undefined);

    await service.changePassword("admin-id", "family", "old", "new password value", actor);

    expect(order).toEqual(["revoke", "transaction"]);
  });

  test("does not change the password when revoking the other sessions fails", async () => {
    const { service, sessions, order } = build(async () => undefined);
    sessions.revokeAllExceptCurrent.mockRejectedValueOnce(new Error("redis down"));

    await expect(
      service.changePassword("admin-id", "family", "old", "new password value", actor),
    ).rejects.toThrow("redis down");

    expect(order).not.toContain("transaction");
  });

  test("leaves the current session usable when the transaction fails", async () => {
    const { service } = build(async () => {
      throw new Error("audit failed");
    });

    await expect(
      service.changePassword("admin-id", "family", "old", "new password value", actor),
    ).rejects.toThrow("audit failed");
  });
});

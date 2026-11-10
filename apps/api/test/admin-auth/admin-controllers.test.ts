import { describe, expect, test, vi } from "vitest";
import { AdminAccountController } from "../../src/admin-auth/admin-account.controller";
import { AdminMeController } from "../../src/admin-auth/admin-me.controller";
import { AuditLogController } from "../../src/audit/audit-log.controller";

const session = { userId: "admin-id", familyId: "family" };

describe("AdminMeController.describe", () => {
  test("describes the signed-in administrator", async () => {
    const describe = vi.fn().mockResolvedValue({ id: "admin-id" });

    const result = await new AdminMeController({ describe } as never).describe(session as never);

    expect(result).toEqual({ id: "admin-id" });
    expect(describe).toHaveBeenCalledWith("admin-id");
  });
});

describe("AdminAccountController.changePassword", () => {
  test("changes the password for the session's own account and family with an audit actor", async () => {
    const changePassword = vi.fn().mockResolvedValue(undefined);
    const request = { headers: { "x-request-id": "req-2" }, ip: "203.0.113.4" };

    await new AdminAccountController({ changePassword } as never).changePassword(
      { currentPassword: "old", newPassword: "new" },
      session as never,
      request as never,
    );

    expect(changePassword).toHaveBeenCalledWith("admin-id", "family", "old", "new", {
      actorId: "admin-id",
      ipAddress: "203.0.113.4",
      requestId: "req-2",
    });
  });
});

describe("AuditLogController.list", () => {
  test("lists with the query", async () => {
    const list = vi.fn().mockResolvedValue({ items: [] });
    const query = { page: 1, pageSize: 20 };

    expect(await new AuditLogController({ list } as never).list(query as never)).toEqual({
      items: [],
    });
    expect(list).toHaveBeenCalledWith(query);
  });
});

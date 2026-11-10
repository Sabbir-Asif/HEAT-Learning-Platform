import { describe, expect, test, vi } from "vitest";
import { AdminInvitationService } from "../../src/admin-management/admin-invitation.service";
import { AuditService } from "../../src/audit";
import { hashOpaqueToken } from "../../src/auth";
import type { PasswordService } from "../../src/auth";
import type { Clock } from "../../src/core";

const now = new Date("2026-11-10T06:00:00.000Z");
const clock: Clock = { now: () => now };

const build = (userUpdateCount: number) => {
  const tx = {
    authToken: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    user: {
      updateMany: vi.fn().mockResolvedValue({ count: userUpdateCount }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const database = {
    authToken: {
      findUnique: vi.fn().mockResolvedValue({
        id: "token-id",
        userId: "user-id",
        purpose: "INVITE",
        usedAt: null,
        expiresAt: new Date(now.getTime() + 3_600_000),
        user: {
          email: "a@example.test",
          realm: "ADMIN",
          deletedAt: null,
          deactivatedAt: null,
        },
      }),
    },
    $transaction: vi.fn(async (run: (client: typeof tx) => Promise<void>) => run(tx)),
  };
  const passwords = { hashChecked: vi.fn().mockResolvedValue("hash") };
  const service = new AdminInvitationService(
    database as never,
    clock,
    passwords as unknown as PasswordService,
    new AuditService({} as never),
  );
  return { service, tx, database };
};

describe("AdminInvitationService.accept", () => {
  test("the user is updated only while still active and not deleted", async () => {
    const { service, tx } = build(1);

    await service.accept({ token: "t", password: "long enough password" }, {});

    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-id", deactivatedAt: null, deletedAt: null },
      data: expect.objectContaining({ passwordHash: "hash", mustChangePassword: false }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  test("an account deactivated or deleted after the first check rejects the acceptance", async () => {
    const { service, tx, database } = build(0);

    await expect(
      service.accept({ token: "t", password: "long enough password" }, {}),
    ).rejects.toMatchObject({ status: 400 });
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(database.authToken.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashOpaqueToken("t") } }),
    );
  });
});

import { Logger } from "@nestjs/common";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AdminUsersService } from "../../src/admin-management/admin-users.service";
import { AuditService } from "../../src/audit";
import type { PasswordService, SessionService } from "../../src/auth";
import type { AppConfig, Clock, SecretBox } from "../../src/core";

const now = new Date("2026-11-10T06:00:00.000Z");
const clock: Clock = { now: () => now };
const targetId = "0198f1a0-0000-7000-8000-000000000001";

const row = {
  id: targetId,
  email: "admin@example.test",
  role: "ADMIN",
  createdAt: now,
  deactivatedAt: null as Date | null,
  authTokens: [],
};

const build = (revokeAll: () => Promise<void>, deactivatedAt: Date | null = null) => {
  const tx = {
    user: { update: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const database = {
    user: { findFirst: vi.fn().mockResolvedValue({ ...row, deactivatedAt }) },
    $transaction: vi.fn(async (run: (client: typeof tx) => Promise<unknown>) => run(tx)),
  };
  const sessions = { revokeAll: vi.fn(revokeAll) };
  const service = new AdminUsersService(
    database as never,
    {} as AppConfig,
    clock,
    {} as PasswordService,
    sessions as unknown as SessionService,
    {} as SecretBox,
    new AuditService({} as never),
  );
  return { service, tx, sessions };
};

afterEach(() => vi.restoreAllMocks());

describe("AdminUsersService.reactivate", () => {
  test("the audit entry records the status before and after", async () => {
    const { service, tx } = build(async () => undefined, now);

    await service.reactivate(targetId, { actorId: "actor" });

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "admin.reactivate",
        before: { status: "DEACTIVATED" },
        after: { status: "ACTIVE" },
      }),
    });
  });
});

describe("AdminUsersService.deactivate", () => {
  test("a failed session revocation after the commit is logged without personal data and rethrown", async () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const { service, tx } = build(async () => {
      throw new Error("redis down for admin@example.test");
    });

    await expect(service.deactivate(targetId, { actorId: "actor" })).rejects.toThrow();

    expect(tx.user.update).toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).not.toContain("admin@example.test");
    expect(message).not.toContain(targetId);
  });
});

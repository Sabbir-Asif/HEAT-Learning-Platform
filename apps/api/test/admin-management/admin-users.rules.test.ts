import { describe, expect, test, vi } from "vitest";
import { AdminUsersService } from "../../src/admin-management/admin-users.service";
import { AuditService } from "../../src/audit";
import type { PasswordService, SessionService } from "../../src/auth";
import type { AppConfig, Clock, SecretBox } from "../../src/core";

const now = new Date("2026-11-10T06:00:00.000Z");
const clock: Clock = { now: () => now };
const targetId = "0198f1a0-0000-7000-8000-000000000001";
const context = { actorId: "actor" };

interface Row {
  id: string;
  email: string;
  role: string;
  createdAt: Date;
  deactivatedAt: Date | null;
  authTokens: { expiresAt: Date }[];
}

const rowOf = (overrides: Partial<Row> = {}): Row => ({
  id: targetId,
  email: "admin@example.test",
  role: "ADMIN",
  createdAt: now,
  deactivatedAt: null,
  authTokens: [],
  ...overrides,
});

const build = (
  options: {
    found?: Row | null;
    existing?: unknown;
    uniqueFailure?: boolean;
    inviting?: boolean;
  } = {},
) => {
  const found = options.found === undefined ? rowOf() : options.found;
  const tx = {
    user: {
      create: vi.fn().mockResolvedValue({ id: targetId }),
      update: vi.fn().mockResolvedValue({}),
    },
    authToken: {
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
    outbox: { create: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const database = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "matched-id" }]),
    user: {
      findFirst: options.inviting
        ? vi
            .fn()
            .mockResolvedValueOnce(options.existing ?? null)
            .mockResolvedValue(found)
        : vi.fn().mockResolvedValue(found),
      findMany: vi.fn().mockResolvedValue([rowOf()]),
      count: vi.fn().mockResolvedValue(1),
    },
    $transaction: vi.fn(async (run: (client: typeof tx) => Promise<unknown>) => {
      if (options.uniqueFailure) throw Object.assign(new Error("unique"), { code: "P2002" });
      return run(tx);
    }),
  };
  const sessions = { revokeAll: vi.fn().mockResolvedValue(undefined) };
  const secretBox = { encrypt: vi.fn().mockReturnValue("sealed") };
  const service = new AdminUsersService(
    database as never,
    { invitations: { ttlHours: 48 } } as AppConfig,
    clock,
    { hash: vi.fn().mockResolvedValue("digest") } as unknown as PasswordService,
    sessions as unknown as SessionService,
    secretBox as unknown as SecretBox,
    new AuditService({} as never),
  );
  return { service, database, tx, sessions };
};

describe("AdminUsersService.list", () => {
  test.each([
    ["email", { email: "asc" }],
    ["-email", { email: "desc" }],
    ["createdAt", { createdAt: "asc" }],
    ["-createdAt", { createdAt: "desc" }],
  ] as const)("sorts by %s and pages", async (sort, expected) => {
    const { service, database } = build();

    const result = await service.list({ page: 3, pageSize: 10, sort } as never);

    expect(database.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [expected, { id: "asc" }], skip: 20, take: 10 }),
    );
    expect(result).toMatchObject({ total: 1, page: 3, pageSize: 10 });
    expect(result.items[0]?.status).toBe("ACTIVE");
  });
});

describe("AdminUsersService.invite", () => {
  test("refuses an address that is already in use", async () => {
    const { service, tx } = build({ existing: { id: "other" }, inviting: true });

    await expect(service.invite({ email: "admin@example.test" }, context)).rejects.toMatchObject({
      code: "EMAIL_IN_USE",
    });
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  test("creates the admin, a hashed invite token and an outbox entry with an encrypted token, then audits", async () => {
    const { service, tx } = build({
      found: rowOf({ authTokens: [{ expiresAt: now }] }),
      inviting: true,
    });

    const summary = await service.invite({ email: "new@example.test" }, context);

    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { email: "new@example.test", passwordHash: "digest", role: "ADMIN", realm: "ADMIN" },
      }),
    );
    const token = tx.authToken.create.mock.calls[0]?.[0].data;
    expect(token.purpose).toBe("INVITE");
    expect(token.expiresAt).toEqual(new Date(now.getTime() + 48 * 3_600_000));
    expect(token.tokenHash).not.toContain("sealed");
    expect(tx.outbox.create.mock.calls[0]?.[0].data.payload).toMatchObject({
      encryptedToken: "sealed",
      template: "admin-invitation",
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "admin.invite", after: { status: "INVITED" } }),
    });
    expect(summary.status).toBe("INVITE_EXPIRED");
  });

  test("turns a unique violation from a concurrent invite into EMAIL_IN_USE", async () => {
    const { service } = build({ uniqueFailure: true, inviting: true });

    await expect(service.invite({ email: "a@example.test" }, context)).rejects.toMatchObject({
      code: "EMAIL_IN_USE",
    });
  });

  test("rethrows other failures", async () => {
    const { service, database } = build({ inviting: true });
    database.$transaction.mockRejectedValue(new Error("db down"));

    await expect(service.invite({ email: "a@example.test" }, context)).rejects.toThrow("db down");
  });
});

describe("AdminUsersService.resendInvitation", () => {
  test("refuses an administrator who is already active", async () => {
    const { service } = build();

    await expect(service.resendInvitation(targetId, context)).rejects.toMatchObject({
      code: "INVITATION_NOT_PENDING",
    });
  });

  test("refuses a deactivated administrator", async () => {
    const { service } = build({
      found: rowOf({ deactivatedAt: now, authTokens: [{ expiresAt: now }] }),
    });

    await expect(service.resendInvitation(targetId, context)).rejects.toMatchObject({
      code: "INVITATION_NOT_PENDING",
    });
  });

  test("replaces the unused token and audits the status change", async () => {
    const expired = new Date(now.getTime() - 1000);
    const { service, tx } = build({ found: rowOf({ authTokens: [{ expiresAt: expired }] }) });

    await service.resendInvitation(targetId, context);

    expect(tx.authToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: targetId, purpose: "INVITE", usedAt: null },
    });
    expect(tx.authToken.create).toHaveBeenCalledOnce();
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "admin.invite.resend",
        before: { status: "INVITE_EXPIRED" },
        after: { status: "INVITED" },
      }),
    });
  });
});

describe("AdminUsersService.deactivate", () => {
  test("an administrator cannot deactivate their own account", async () => {
    const { service, tx } = build();

    await expect(service.deactivate(targetId, { actorId: targetId })).rejects.toMatchObject({
      code: "CANNOT_DEACTIVATE_SELF",
    });
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  test("deactivates, audits and revokes every session", async () => {
    const { service, tx, sessions } = build();

    const summary = await service.deactivate(targetId, context);

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: targetId },
      data: { deactivatedAt: now },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "admin.deactivate",
        before: { status: "ACTIVE" },
        after: { status: "DEACTIVATED" },
      }),
    });
    expect(sessions.revokeAll).toHaveBeenCalledWith(targetId);
    expect(summary.id).toBe(targetId);
  });

  test("an already deactivated administrator is not audited again but sessions are still revoked", async () => {
    const { service, tx, sessions } = build({ found: rowOf({ deactivatedAt: now }) });

    await service.deactivate(targetId, context);

    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(sessions.revokeAll).toHaveBeenCalledWith(targetId);
  });
});

describe("AdminUsersService.reactivate and lookups", () => {
  test("reactivating an active administrator changes nothing", async () => {
    const { service, tx } = build();

    await service.reactivate(targetId, context);

    expect(tx.user.update).not.toHaveBeenCalled();
  });

  test("reactivating a deactivated administrator clears the flag", async () => {
    const { service, tx } = build({ found: rowOf({ deactivatedAt: now }) });

    await service.reactivate(targetId, context);

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: targetId },
      data: { deactivatedAt: null },
    });
  });

  test("an unknown administrator is NOT_FOUND", async () => {
    const { service } = build({ found: null });

    await expect(service.reactivate(targetId, context)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  test("a super administrator cannot be managed", async () => {
    const { service } = build({ found: rowOf({ role: "SUPER_ADMIN" }) });

    await expect(service.deactivate(targetId, context)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

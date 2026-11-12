import { describe, expect, test, vi } from "vitest";
import { ApiException } from "../../src/http/api-exception";
import { PasswordChangeService } from "../../src/me/password-change.service";
import { sealPasswordCode } from "../../src/me/password-code";

const now = new Date("2026-11-12T10:00:00Z");
const actor = { actorId: "user-id", ipAddress: "127.0.0.1", requestId: "r" };
const request = {
  currentPassword: "old password value",
  code: "123456",
  newPassword: "a brand new passphrase",
};

const build = (
  options: {
    verified?: boolean;
    storedCode?: string | null;
    attempt?: number;
    recentCodes?: number;
    passwordMatches?: boolean;
    claimed?: number;
  } = {},
) => {
  const {
    verified = true,
    storedCode = "123456",
    attempt = 1,
    recentCodes = 0,
    passwordMatches = true,
    claimed = 1,
  } = options;
  const order: string[] = [];
  const tx = {
    authToken: {
      updateMany: vi.fn().mockResolvedValue({ count: claimed }),
      create: vi.fn().mockResolvedValue({}),
    },
    user: { update: vi.fn().mockResolvedValue({}) },
    outbox: { create: vi.fn().mockResolvedValue({}) },
  };
  const database = {
    user: {
      findFirst: vi.fn().mockResolvedValue({
        email: "anne@example.test",
        passwordHash: "digest",
        emailVerifiedAt: verified ? now : null,
      }),
    },
    authToken: {
      count: vi.fn().mockResolvedValue(recentCodes),
      findFirst: vi.fn().mockResolvedValue(
        storedCode === null
          ? null
          : {
              id: "token-id",
              tokenHash: sealPasswordCode(storedCode),
              expiresAt: new Date(now.getTime() + 600_000),
            },
      ),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: vi.fn(async (work: (client: typeof tx) => Promise<void>) => {
      order.push("transaction");
      await work(tx);
    }),
  };
  const passwords = {
    verify: vi.fn().mockResolvedValue(passwordMatches),
    hashChecked: vi.fn().mockResolvedValue("new-digest"),
  };
  const sessions = {
    revokeAllExceptCurrent: vi.fn(async () => {
      order.push("revoke");
    }),
  };
  const lockout = {
    reserve: vi.fn().mockResolvedValue(undefined),
    recordSuccess: vi.fn().mockResolvedValue(undefined),
  };
  const attempts = { hit: vi.fn().mockResolvedValue({ count: attempt, ttlSeconds: 600 }) };
  const secretBox = { encrypt: vi.fn((value: string) => `sealed-${value}`) };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new PasswordChangeService(
    database as never,
    { now: () => now } as never,
    passwords as never,
    sessions as never,
    lockout as never,
    attempts as never,
    secretBox as never,
    audit as never,
  );
  return { service, database, tx, passwords, sessions, lockout, order, audit, secretBox };
};

const failure = async (action: Promise<unknown>): Promise<ApiException> => {
  try {
    await action;
  } catch (error) {
    return error as ApiException;
  }
  throw new Error("expected a failure");
};

describe("PasswordChangeService.requestCode", () => {
  test("refuses an unverified email with its own code and sends nothing", async () => {
    const { service, tx } = build({ verified: false });

    const error = await failure(service.requestCode("user-id"));

    expect(error.code).toBe("PASSWORD_CODE_EMAIL_UNVERIFIED");
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });

  test("replaces earlier codes and queues the sealed code with its lifetime", async () => {
    const { service, tx, secretBox } = build();

    const result = await service.requestCode("user-id");

    expect(result).toEqual({ expiresInMinutes: 15 });
    expect(tx.authToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { usedAt: now } }),
    );
    const stored = tx.authToken.create.mock.calls[0]?.[0] as {
      data: { tokenHash: string; expiresAt: Date };
    };
    expect(stored.data.expiresAt).toEqual(new Date("2026-11-12T10:15:00Z"));
    const payload = (tx.outbox.create.mock.calls[0]?.[0] as { data: { payload: unknown } }).data
      .payload as { encryptedCode: string; template: string };
    expect(payload.template).toBe("password-change-code");
    expect(payload.encryptedCode).toMatch(/^sealed-\d{6}$/);
    expect(stored.data.tokenHash).not.toContain(payload.encryptedCode.slice(-6));
    expect(secretBox.encrypt).toHaveBeenCalledTimes(1);
  });

  test("returns 429 above the per-account limit", async () => {
    const { service, tx } = build({ recentCodes: 5 });

    const error = await failure(service.requestCode("user-id"));

    expect(error.getStatus()).toBe(429);
    expect(error.code).toBe("RATE_LIMITED");
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });
});

describe("PasswordChangeService.change", () => {
  test("changes the password and revokes other sessions before the transaction", async () => {
    const { service, tx, order, sessions, lockout, audit } = build();

    await service.change("user-id", "family", request, actor);

    expect(order).toEqual(["revoke", "transaction"]);
    expect(sessions.revokeAllExceptCurrent).toHaveBeenCalledWith("user-id", "family");
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "user-id" },
      data: { passwordHash: "new-digest" },
    });
    expect(audit.record).toHaveBeenCalled();
    expect(lockout.recordSuccess).toHaveBeenCalledWith("student", "anne@example.test", "127.0.0.1");
  });

  test("refuses an unverified email", async () => {
    const { service } = build({ verified: false });
    expect((await failure(service.change("user-id", "family", request, actor))).code).toBe(
      "PASSWORD_CODE_EMAIL_UNVERIFIED",
    );
  });

  test("counts a wrong current password toward the lockout and stops there", async () => {
    const { service, lockout, database, sessions } = build({ passwordMatches: false });

    const error = await failure(service.change("user-id", "family", request, actor));

    expect(error.code).toBe("INVALID_CREDENTIALS");
    expect(lockout.reserve).toHaveBeenCalledWith("student", "anne@example.test", "127.0.0.1");
    expect(lockout.recordSuccess).not.toHaveBeenCalled();
    expect(database.authToken.findFirst).not.toHaveBeenCalled();
    expect(sessions.revokeAllExceptCurrent).not.toHaveBeenCalled();
  });

  test("refuses when no unexpired code exists", async () => {
    const { service } = build({ storedCode: null });
    const error = await failure(service.change("user-id", "family", request, actor));
    expect(error.code).toBe("PASSWORD_CODE_EXPIRED");
    expect(error.getStatus()).toBe(410);
  });

  test("refuses a wrong code without changing anything", async () => {
    const { service, tx, sessions, database } = build({ storedCode: "654321" });

    const error = await failure(service.change("user-id", "family", request, actor));

    expect(error.code).toBe("PASSWORD_CODE_INVALID");
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(sessions.revokeAllExceptCurrent).not.toHaveBeenCalled();
    expect(database.authToken.updateMany).not.toHaveBeenCalled();
  });

  test("invalidates the code on the last allowed wrong try", async () => {
    const { service, database } = build({ storedCode: "654321", attempt: 5 });

    const error = await failure(service.change("user-id", "family", request, actor));

    expect(error.code).toBe("PASSWORD_CODE_INVALID");
    expect(database.authToken.updateMany).toHaveBeenCalledWith({
      where: { id: "token-id", usedAt: null },
      data: { usedAt: now },
    });
  });

  test("refuses even the right code once the tries are used up", async () => {
    const { service, database, tx } = build({ attempt: 6 });

    const error = await failure(service.change("user-id", "family", request, actor));

    expect(error.code).toBe("PASSWORD_CODE_EXPIRED");
    expect(database.authToken.updateMany).toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  test("refuses a code that was already claimed by another request", async () => {
    const { service, tx } = build({ claimed: 0 });

    const error = await failure(service.change("user-id", "family", request, actor));

    expect(error.code).toBe("PASSWORD_CODE_EXPIRED");
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  test("keeps the code and sessions when the new password is breached", async () => {
    const { service, passwords, sessions, tx } = build();
    passwords.hashChecked.mockRejectedValueOnce(new ApiException(400, "PASSWORD_BREACHED"));

    const error = await failure(service.change("user-id", "family", request, actor));

    expect(error.code).toBe("PASSWORD_BREACHED");
    expect(sessions.revokeAllExceptCurrent).not.toHaveBeenCalled();
    expect(tx.authToken.updateMany).not.toHaveBeenCalled();
  });
});

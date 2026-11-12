import { describe, expect, test, vi } from "vitest";
import { hashOpaqueToken } from "../../src/auth";
import { ApiException } from "../../src/http/api-exception";
import { PasswordResetService } from "../../src/password-reset/password-reset.service";

const now = new Date("2026-11-10T00:00:00.000Z");

const build = (
  options: {
    user?: unknown;
    recent?: number;
    claimCount?: number;
    row?: unknown;
    updated?: number;
  } = {},
) => {
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    $queryRaw: vi.fn().mockResolvedValue([{ id: "user-id" }]),
    authToken: {
      count: vi.fn().mockResolvedValue(options.recent ?? 0),
      updateMany: vi.fn().mockResolvedValue({ count: options.claimCount ?? 1 }),
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(
        "row" in options
          ? options.row
          : {
              userId: "user-id",
              purpose: "RESET_PASSWORD",
              usedAt: now,
              expiresAt: new Date(now.getTime() + 1000),
            },
      ),
    },
    user: {
      findFirst: vi.fn().mockResolvedValue("user" in options ? options.user : { id: "user-id" }),
      updateMany: vi.fn().mockResolvedValue({ count: options.updated ?? 1 }),
      findUnique: vi.fn().mockResolvedValue({ email: "anne@example.com" }),
    },
    session: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
    outbox: { create: vi.fn().mockResolvedValue({}) },
  };
  const database = {
    $transaction: vi
      .fn()
      .mockImplementation(async (work: (client: unknown) => unknown) => work(tx)),
  };
  const captcha = { verify: vi.fn().mockResolvedValue(undefined) };
  const timing = { equalise: vi.fn().mockImplementation((work: () => unknown) => work()) };
  const passwords = { hashChecked: vi.fn().mockResolvedValue("new-digest") };
  const lockout = { clearAccount: vi.fn().mockResolvedValue(undefined) };
  const secretBox = { encrypt: vi.fn().mockReturnValue("sealed") };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new PasswordResetService(
    database as never,
    { now: () => now } as never,
    { passwordReset: { ttlMinutes: 60 } } as never,
    captcha as never,
    timing as never,
    passwords as never,
    secretBox as never,
    audit as never,
    lockout as never,
  );
  return { service, tx, database, captcha, timing, passwords, audit, lockout };
};

const forgot = {
  email: "anne@example.com",
  captchaId: "1b4e28ba-2fa1-41d2-883f-0016d3cca427",
  captchaAnswer: "AB12",
};

describe("PasswordResetService.request", () => {
  test("queues one reset email in a stored-hash token for a verified account", async () => {
    const { service, tx } = build();

    const result = await service.request(forgot);

    expect(result).toEqual({ accepted: true });
    expect(tx.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ realm: "STUDENT", emailVerifiedAt: { not: null } }),
      }),
    );
    const stored = tx.authToken.create.mock.calls[0]?.[0] as {
      data: { tokenHash: string; purpose: string; expiresAt: Date };
    };
    expect(stored.data.purpose).toBe("RESET_PASSWORD");
    expect(stored.data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.data.expiresAt).toEqual(new Date("2026-11-10T01:00:00.000Z"));
    expect(tx.outbox.create).toHaveBeenCalledTimes(1);
    expect(tx.outbox.create).toHaveBeenCalledWith({
      data: {
        eventType: "student.password.reset.requested",
        payload: { template: "password-reset", userId: "user-id", encryptedToken: "sealed" },
      },
    });
  });

  test("supersedes earlier unused reset links", async () => {
    const { service, tx } = build();

    await service.request(forgot);

    expect(tx.authToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-id", purpose: "RESET_PASSWORD", usedAt: null },
      data: { usedAt: now },
    });
  });

  test("returns the same response and queues nothing for an unknown or unverified email", async () => {
    const { service, tx } = build({ user: null });

    await expect(service.request(forgot)).resolves.toEqual({ accepted: true });
    expect(tx.outbox.create).not.toHaveBeenCalled();
    expect(tx.authToken.create).not.toHaveBeenCalled();
  });

  test("returns the same response and queues nothing once the per-email cap is reached", async () => {
    const { service, tx } = build({ recent: 3 });

    await expect(service.request(forgot)).resolves.toEqual({ accepted: true });
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });

  test("refuses a wrong captcha before touching the database", async () => {
    const { service, captcha, database } = build();
    captcha.verify.mockRejectedValue(new ApiException(400, "CAPTCHA_INVALID"));

    await expect(service.request(forgot)).rejects.toMatchObject({ status: 400 });
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  test("runs inside the response timing floor", async () => {
    const { service, timing } = build();

    await service.request(forgot);

    expect(timing.equalise).toHaveBeenCalledTimes(1);
  });
});

describe("PasswordResetService.reset", () => {
  test("claims the hashed token, sets the checked password and revokes every session", async () => {
    const { service, tx, passwords, audit } = build();

    await service.reset("plain-token", "a-new-long-password", { ipAddress: "203.0.113.4" });

    expect(passwords.hashChecked).toHaveBeenCalledWith("a-new-long-password");
    expect(tx.authToken.updateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: hashOpaqueToken("plain-token"),
        purpose: "RESET_PASSWORD",
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });
    expect(tx.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { passwordHash: "new-digest", mustChangePassword: false } }),
    );
    expect(tx.session.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-id", revokedAt: null },
      data: { revokedAt: now },
    });
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ actorId: "user-id" }),
      expect.objectContaining({ action: "student.password.reset", entityId: "user-id" }),
    );
  });

  test("clears the sign-in lockout for the account once the reset has committed", async () => {
    const { service, lockout } = build();

    await service.reset("plain-token", "a-new-long-password", {});

    expect(lockout.clearAccount).toHaveBeenCalledWith("student", "anne@example.com");
  });

  test("a reset that is refused leaves the lockout alone", async () => {
    const { service, lockout } = build({ claimCount: 0 });

    await service.reset("t", "a-new-long-password", {}).catch(() => undefined);

    expect(lockout.clearAccount).not.toHaveBeenCalled();
  });

  test("a lockout store failure does not fail a committed reset", async () => {
    const { service, lockout } = build();
    lockout.clearAccount.mockRejectedValue(new Error("redis down"));

    await expect(service.reset("t", "a-new-long-password", {})).resolves.toBeUndefined();
  });

  test("rejects a link that was already used", async () => {
    const { service, tx } = build({ claimCount: 0 });

    await expect(service.reset("t", "a-new-long-password", {})).rejects.toMatchObject({
      status: 409,
    });
    expect(tx.session.updateMany).not.toHaveBeenCalled();
  });

  test("rejects an expired link", async () => {
    const { service } = build({
      claimCount: 0,
      row: { userId: "user-id", purpose: "RESET_PASSWORD", usedAt: null, expiresAt: now },
    });

    await expect(service.reset("t", "a-new-long-password", {})).rejects.toMatchObject({
      status: 410,
    });
  });

  test("rejects an unknown link", async () => {
    const { service } = build({ claimCount: 0, row: null });

    await expect(service.reset("t", "a-new-long-password", {})).rejects.toMatchObject({
      status: 404,
    });
  });

  test("rejects when the account is no longer eligible and revokes nothing", async () => {
    const { service, tx } = build({ updated: 0 });

    await expect(service.reset("t", "a-new-long-password", {})).rejects.toMatchObject({
      status: 404,
    });
    expect(tx.session.updateMany).not.toHaveBeenCalled();
  });

  test("a breached password is refused before the token is claimed", async () => {
    const { service, passwords, database } = build();
    passwords.hashChecked.mockRejectedValue(new ApiException(400, "PASSWORD_BREACHED"));

    await expect(service.reset("t", "password1234567", {})).rejects.toMatchObject({ status: 400 });
    expect(database.$transaction).not.toHaveBeenCalled();
  });
});

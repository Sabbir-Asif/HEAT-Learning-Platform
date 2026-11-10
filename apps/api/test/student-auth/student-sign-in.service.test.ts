import { Logger } from "@nestjs/common";
import { afterEach, describe, expect, test, vi } from "vitest";
import { StudentSignInService } from "../../src/student-auth/student-sign-in.service";

const metadata = { userAgent: "agent", ipAddress: "203.0.113.4" };
const tokens = { access: "a", refresh: "r" };

interface Options {
  user?: { id: string; passwordHash: string } | null;
  matches?: boolean;
  needsRehash?: boolean;
  reserve?: () => Promise<void>;
}

const build = (options: Options = {}) => {
  const user =
    options.user === undefined ? { id: "user-id", passwordHash: "digest" } : options.user;
  const database = {
    user: {
      findFirst: vi.fn().mockResolvedValue(user),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  const passwords = {
    hash: vi.fn().mockResolvedValue("fresh-digest"),
    verify: vi.fn().mockResolvedValue(options.matches ?? true),
    needsRehash: vi.fn().mockReturnValue(options.needsRehash ?? false),
  };
  const sessions = { create: vi.fn().mockResolvedValue(tokens) };
  const lockout = {
    reserve: vi.fn(options.reserve ?? (async () => undefined)),
    recordSuccess: vi.fn().mockResolvedValue(undefined),
  };
  const service = new StudentSignInService(
    database as never,
    passwords as never,
    sessions as never,
    lockout as never,
  );
  return { service, database, passwords, sessions, lockout };
};

afterEach(() => vi.restoreAllMocks());

describe("StudentSignInService", () => {
  test("creates a decoy digest on start", async () => {
    const { service, passwords } = build();

    await service.onModuleInit();

    expect(passwords.hash).toHaveBeenCalledTimes(1);
  });

  test("signs in with matching credentials, clears the lockout and opens a session", async () => {
    const { service, sessions, lockout } = build();

    const result = await service.signIn("a@example.test", "secret", metadata);

    expect(result).toEqual({ userId: "user-id", tokens });
    expect(lockout.reserve).toHaveBeenCalledWith("student", "a@example.test", "203.0.113.4");
    expect(lockout.recordSuccess).toHaveBeenCalledWith("student", "a@example.test", "203.0.113.4");
    expect(sessions.create).toHaveBeenCalledWith("user-id", "student", metadata);
  });

  test("a wrong password answers INVALID_CREDENTIALS and opens no session", async () => {
    const { service, sessions, lockout } = build({ matches: false });

    await expect(service.signIn("a@example.test", "bad", metadata)).rejects.toMatchObject({
      status: 401,
    });
    expect(sessions.create).not.toHaveBeenCalled();
    expect(lockout.recordSuccess).not.toHaveBeenCalled();
  });

  test("an unknown account is verified against the decoy so the work is the same", async () => {
    const { service, passwords } = build({ user: null, matches: true });
    await service.onModuleInit();

    await expect(service.signIn("nobody@example.test", "x", metadata)).rejects.toMatchObject({
      status: 401,
    });
    expect(passwords.verify).toHaveBeenCalledWith("fresh-digest", "x");
  });

  test("a locked account stops before any lookup", async () => {
    const { service, database } = build({
      reserve: async () => {
        throw new Error("locked");
      },
    });

    await expect(service.signIn("a@example.test", "x", metadata)).rejects.toThrow("locked");
    expect(database.user.findFirst).not.toHaveBeenCalled();
  });

  test("upgrades an outdated digest after a successful sign-in", async () => {
    const { service, database } = build({ needsRehash: true });

    await service.signIn("a@example.test", "secret", metadata);

    expect(database.user.update).toHaveBeenCalledWith({
      where: { id: "user-id" },
      data: { passwordHash: "fresh-digest" },
    });
  });

  test("still signs in when the digest upgrade fails, and logs no password data", async () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const { service, database, sessions } = build({ needsRehash: true });
    database.user.update.mockRejectedValue(new Error("write failed"));

    await service.signIn("a@example.test", "secret", metadata);

    expect(sessions.create).toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("Password hash could not be upgraded");
  });
});

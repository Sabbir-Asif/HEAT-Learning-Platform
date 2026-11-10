import { describe, expect, test, vi } from "vitest";
import { AdminSignInService } from "../../src/admin-auth/admin-sign-in.service";

const actor = { actorId: null, ipAddress: "127.0.0.1", requestId: "r" };

const build = (recordStandalone: () => Promise<void>) => {
  const database = {
    user: {
      findFirst: vi.fn().mockResolvedValue({ id: "admin-id", passwordHash: "digest" }),
      update: vi.fn(),
    },
  };
  const passwords = {
    verify: vi.fn().mockResolvedValue(true),
    needsRehash: vi.fn().mockReturnValue(false),
  };
  const sessions = {
    create: vi.fn().mockResolvedValue({ familyId: "family" }),
    revoke: vi.fn().mockResolvedValue(undefined),
  };
  const lockout = {
    reserve: vi.fn().mockResolvedValue(undefined),
    recordSuccess: vi.fn().mockResolvedValue(undefined),
  };
  const service = new AdminSignInService(
    database as never,
    passwords as never,
    sessions as never,
    lockout as never,
    { recordStandalone } as never,
  );
  return { service, sessions };
};

const metadata = { ipAddress: "127.0.0.1" };

describe("AdminSignInService.signIn", () => {
  test("returns the tokens and keeps the session when the audit write succeeds", async () => {
    const { service, sessions } = build(async () => undefined);

    const result = await service.signIn("a@example.test", "pw", metadata, actor);

    expect(result.userId).toBe("admin-id");
    expect(sessions.revoke).not.toHaveBeenCalled();
  });

  test("revokes the new session and rethrows when the audit write fails", async () => {
    const { service, sessions } = build(async () => {
      throw new Error("audit failed");
    });

    await expect(service.signIn("a@example.test", "pw", metadata, actor)).rejects.toThrow(
      "audit failed",
    );

    expect(sessions.revoke).toHaveBeenCalledWith("family");
  });
});

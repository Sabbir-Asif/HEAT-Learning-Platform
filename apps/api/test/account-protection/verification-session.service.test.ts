import { describe, expect, test, vi } from "vitest";
import { VerificationSessionService } from "../../src/account-protection/verification-session.service";
import type { Clock } from "../../src/core";

const now = new Date("2026-11-10T06:00:00.000Z");
const clock: Clock = { now: () => now };

const build = (families: string[]) => {
  const writer = {
    session: {
      findMany: vi.fn().mockResolvedValue(families.map((familyId) => ({ familyId }))),
      updateMany: vi.fn().mockResolvedValue({}),
    },
  };
  const sessions = { create: vi.fn().mockResolvedValue({ access: "a", refresh: "r" }) };
  const service = new VerificationSessionService(writer as never, clock, sessions as never);
  return { service, writer, sessions };
};

describe("VerificationSessionService", () => {
  test("stamps verification with the clock", () => {
    expect(build([]).service.verificationTimestamp()).toEqual(now);
  });

  test("revokes only the families that started before verification", async () => {
    const { service, writer } = build(["f1", "f2"]);

    await service.revokeSessionsBeforeVerification("user-id", now);

    expect(writer.session.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-id", createdAt: { lt: now } } }),
    );
    expect(writer.session.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-id", familyId: { in: ["f1", "f2"] }, revokedAt: null },
      data: { revokedAt: now },
    });
  });

  test("writes nothing when there is no earlier session", async () => {
    const { service, writer } = build([]);

    await service.revokeSessionsBeforeVerification("user-id", now);

    expect(writer.session.updateMany).not.toHaveBeenCalled();
  });

  test("uses the writer it is given, such as a transaction", async () => {
    const { service, writer } = build(["f1"]);
    const other = {
      session: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn() },
    };

    await service.revokeSessionsBeforeVerification("user-id", now, other as never);

    expect(other.session.findMany).toHaveBeenCalled();
    expect(writer.session.findMany).not.toHaveBeenCalled();
  });

  test("issues a student session after the commit", async () => {
    const { service, sessions } = build([]);

    await service.issueSessionAfterCommit("user-id", { ipAddress: "203.0.113.4" });
    await service.issueSessionAfterCommit("user-id");

    expect(sessions.create).toHaveBeenNthCalledWith(1, "user-id", "student", {
      ipAddress: "203.0.113.4",
    });
    expect(sessions.create).toHaveBeenNthCalledWith(2, "user-id", "student", {});
  });
});

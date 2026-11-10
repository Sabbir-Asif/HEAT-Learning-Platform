import { describe, expect, test, vi } from "vitest";
import { RegistrationPolicyService } from "../../src/account-protection/registration-policy.service";
import type { Clock } from "../../src/core";

const now = new Date("2026-11-10T06:00:00.000Z");
const clock: Clock = { now: () => now };
const actor = { actorId: null, ipAddress: "203.0.113.4" };

const build = (existing: unknown) => {
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    user: {
      findFirst: vi.fn().mockResolvedValue(existing),
      update: vi.fn().mockResolvedValue({}),
    },
    studentProfile: { updateMany: vi.fn().mockResolvedValue({}) },
    enrollment: { updateMany: vi.fn().mockResolvedValue({}) },
    authToken: { updateMany: vi.fn().mockResolvedValue({}) },
    session: { updateMany: vi.fn().mockResolvedValue({}) },
    outbox: { create: vi.fn().mockResolvedValue({}) },
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new RegistrationPolicyService(clock, audit as never);
  return { service, tx, audit };
};

describe("RegistrationPolicyService.apply", () => {
  test("takes the per-address lock and proceeds when the address is free", async () => {
    const { service, tx, audit } = build(null);

    const outcome = await service.apply(tx as never, "new@example.test", actor);

    expect(outcome).toEqual({ kind: "PROCEED", replacedUserId: null });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(audit.record).not.toHaveBeenCalled();
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });

  test("replaces an unverified student registration and revokes what it owned", async () => {
    const { service, tx, audit } = build({
      id: "old-id",
      realm: "STUDENT",
      emailVerifiedAt: null,
    });

    const outcome = await service.apply(tx as never, "old@example.test", actor);

    expect(outcome).toEqual({ kind: "PROCEED", replacedUserId: "old-id" });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "old-id" },
      data: { deletedAt: now },
    });
    expect(tx.studentProfile.updateMany).toHaveBeenCalled();
    expect(tx.enrollment.updateMany).toHaveBeenCalled();
    expect(tx.authToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "old-id", usedAt: null },
      data: { usedAt: now },
    });
    expect(tx.session.updateMany).toHaveBeenCalledWith({
      where: { userId: "old-id", revokedAt: null },
      data: { revokedAt: now },
    });
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      actor,
      expect.objectContaining({
        action: "student.registration.replaced",
        before: { status: "UNVERIFIED" },
        after: { status: "REPLACED" },
      }),
    );
  });

  test.each([
    ["a verified student", { id: "u1", realm: "STUDENT", emailVerifiedAt: now }],
    ["an administrator", { id: "u2", realm: "ADMIN", emailVerifiedAt: null }],
  ])("reports %s as already registered, queues the notice and changes nothing", async (_, row) => {
    const { service, tx, audit } = build(row);

    const outcome = await service.apply(tx as never, "taken@example.test", actor);

    expect(outcome).toEqual({ kind: "ALREADY_REGISTERED", userId: row.id });
    expect(tx.outbox.create).toHaveBeenCalledWith({
      data: {
        eventType: "student.registration.already_registered",
        payload: { template: "student-already-registered", userId: row.id },
      },
    });
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      actor,
      expect.objectContaining({ action: "student.registration.duplicate", entityId: row.id }),
    );
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});

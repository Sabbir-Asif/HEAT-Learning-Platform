import { describe, expect, test, vi } from "vitest";
import {
  ENROLLMENT_REINSTATED_EVENT_TYPE,
  ENROLLMENT_REMOVED_EVENT_TYPE,
  EnrollmentRemovalService,
} from "../../src/enrollment/enrollment-removal.service";

const now = new Date("2026-11-12T05:00:00.000Z");
const actor = { actorId: "admin-id", ipAddress: "203.0.113.4", requestId: "req-1" };

interface Options {
  status?: string;
  statusBeforeRemoval?: string | null;
  claimed?: number;
  missing?: boolean;
}

const build = (options: Options = {}) => {
  const tx = {
    enrollment: {
      findFirst: vi
        .fn()
        .mockResolvedValueOnce(
          options.missing === true
            ? null
            : {
                id: "enrollment-id",
                status: options.status ?? "APPROVED",
                statusBeforeRemoval: options.statusBeforeRemoval ?? null,
                courseId: "course-id",
                userId: "user-id",
              },
        )
        .mockResolvedValue({ status: "REMOVED" }),
      updateMany: vi.fn().mockResolvedValue({ count: options.claimed ?? 1 }),
    },
    enrollmentDecision: { create: vi.fn().mockResolvedValue({}) },
    outbox: { create: vi.fn().mockResolvedValue({}) },
  };
  const database = {
    $transaction: vi
      .fn()
      .mockImplementation(async (work: (client: unknown) => unknown) => work(tx)),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new EnrollmentRemovalService(
    database as never,
    { now: () => now },
    audit as never,
  );
  return { service, tx, audit };
};

describe("EnrollmentRemovalService.remove", () => {
  test("moves an approved enrollment to removed and stores the previous state", async () => {
    const { service, tx, audit } = build();

    const result = await service.remove("enrollment-id", actor, "Left the university");

    expect(result).toEqual({
      id: "enrollment-id",
      status: "REMOVED",
      removedAt: now.toISOString(),
    });
    expect(tx.enrollment.updateMany).toHaveBeenCalledWith({
      where: { id: "enrollment-id", status: "APPROVED" },
      data: { status: "REMOVED", statusBeforeRemoval: "APPROVED", removedAt: now },
    });
    expect(tx.enrollmentDecision.create).toHaveBeenCalledWith({
      data: {
        enrollmentId: "enrollment-id",
        adminId: "admin-id",
        action: "REMOVE",
        reason: "Left the university",
        decidedAt: now,
      },
    });
    expect(tx.outbox.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: ENROLLMENT_REMOVED_EVENT_TYPE }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      actor,
      expect.objectContaining({ action: "enrollment.remove", entityId: "enrollment-id" }),
    );
  });

  test("stores completed as the previous state for a completed enrollment", async () => {
    const { service, tx } = build({ status: "COMPLETED" });

    await service.remove("enrollment-id", actor, "Misconduct");

    expect(tx.enrollment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statusBeforeRemoval: "COMPLETED" }),
      }),
    );
  });

  test("refuses an enrollment waiting for approval without writing", async () => {
    const { service, tx } = build({ status: "PENDING_APPROVAL" });

    await expect(service.remove("enrollment-id", actor, "x")).rejects.toMatchObject({
      code: "ENROLLMENT_NOT_REMOVABLE",
    });
    expect(tx.enrollment.updateMany).not.toHaveBeenCalled();
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });

  test("answers not found for an unknown enrollment", async () => {
    const { service } = build({ missing: true });

    await expect(service.remove("enrollment-id", actor, "x")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  test("reports a conflict when a concurrent change wins the claim", async () => {
    const { service, tx } = build({ claimed: 0 });

    await expect(service.remove("enrollment-id", actor, "x")).rejects.toMatchObject({
      code: "ENROLLMENT_STATE_CHANGED",
    });
    expect(tx.enrollmentDecision.create).not.toHaveBeenCalled();
  });
});

describe("EnrollmentRemovalService.reinstate", () => {
  test("restores a completed enrollment and clears the removal fields", async () => {
    const { service, tx, audit } = build({
      status: "REMOVED",
      statusBeforeRemoval: "COMPLETED",
    });

    const result = await service.reinstate("enrollment-id", actor, "Appeal accepted");

    expect(result).toEqual({ id: "enrollment-id", status: "COMPLETED" });
    expect(tx.enrollment.updateMany).toHaveBeenCalledWith({
      where: { id: "enrollment-id", status: "REMOVED" },
      data: { status: "COMPLETED", statusBeforeRemoval: null, removedAt: null },
    });
    expect(tx.enrollmentDecision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "REINSTATE", reason: "Appeal accepted" }),
    });
    expect(tx.outbox.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: ENROLLMENT_REINSTATED_EVENT_TYPE }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      actor,
      expect.objectContaining({ action: "enrollment.reinstate" }),
    );
  });

  test("restores an approved enrollment without a reason", async () => {
    const { service, tx } = build({ status: "REMOVED", statusBeforeRemoval: "APPROVED" });

    const result = await service.reinstate("enrollment-id", actor);

    expect(result.status).toBe("APPROVED");
    expect(tx.enrollmentDecision.create).toHaveBeenCalledWith({
      data: {
        enrollmentId: "enrollment-id",
        adminId: "admin-id",
        action: "REINSTATE",
        decidedAt: now,
      },
    });
  });

  test("refuses an enrollment that is not removed", async () => {
    const { service, tx } = build({ status: "APPROVED" });

    await expect(service.reinstate("enrollment-id", actor)).rejects.toMatchObject({
      code: "ENROLLMENT_NOT_REMOVED",
    });
    expect(tx.enrollment.updateMany).not.toHaveBeenCalled();
  });

  test("reports a conflict when a concurrent change wins the claim", async () => {
    const { service } = build({ status: "REMOVED", statusBeforeRemoval: "APPROVED", claimed: 0 });

    await expect(service.reinstate("enrollment-id", actor)).rejects.toMatchObject({
      code: "ENROLLMENT_STATE_CHANGED",
    });
  });
});

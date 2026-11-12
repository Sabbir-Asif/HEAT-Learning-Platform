import { describe, expect, test, vi } from "vitest";
import { ApiException } from "../../src/http/api-exception";
import {
  ENROLLMENT_APPROVED_EVENT_TYPE,
  EnrollmentApprovalService,
} from "../../src/enrollment/enrollment-approval.service";

const now = new Date("2026-11-11T05:00:00.000Z");
const actor = { actorId: "admin-id", ipAddress: "203.0.113.4", requestId: "req-1" };

interface Options {
  status?: string;
  claimed?: number;
  statusAfterClaim?: string;
  lockFails?: boolean;
  progressFails?: boolean;
  missing?: boolean;
}

const build = (options: Options = {}) => {
  const order: string[] = [];
  const tx = {
    enrollment: {
      findFirst: vi
        .fn()
        .mockResolvedValueOnce(
          options.missing === true
            ? null
            : {
                id: "enrollment-id",
                status: options.status ?? "PENDING_APPROVAL",
                courseId: "course-id",
                userId: "user-id",
              },
        )
        .mockResolvedValue({ status: options.statusAfterClaim ?? "APPROVED" }),
      updateMany: vi.fn().mockImplementation(async () => {
        order.push("claim");
        return { count: options.claimed ?? 1 };
      }),
    },
    moduleProgress: {
      createMany: vi.fn().mockImplementation(async () => {
        order.push("progress");
        if (options.progressFails === true) throw new Error("unlock failed");
        return { count: 3 };
      }),
    },
    enrollmentDecision: {
      create: vi.fn().mockImplementation(async () => {
        order.push("decision");
        return {};
      }),
    },
    outbox: {
      create: vi.fn().mockImplementation(async () => {
        order.push("outbox");
        return {};
      }),
    },
  };
  const database = {
    $transaction: vi.fn().mockImplementation(async (work: (client: unknown) => unknown) => {
      return work(tx);
    }),
  };
  const courses = {
    resolveApprovalTarget: vi.fn().mockImplementation(async () => {
      order.push("target");
      return { revisionId: "revision-id", moduleIds: ["m1", "m2", "m3"] };
    }),
  };
  const locks = {
    lockOnFirstApproval: vi.fn().mockImplementation(async () => {
      order.push("lock");
      if (options.lockFails === true) throw new Error("lock failed");
      return true;
    }),
  };
  const audit = {
    record: vi.fn().mockImplementation(async () => {
      order.push("audit");
    }),
  };
  const notifications = {
    createWithin: vi.fn().mockImplementation(async () => {
      order.push("notify");
      return true;
    }),
  };
  const service = new EnrollmentApprovalService(
    database as never,
    { now: () => now },
    courses as never,
    locks as never,
    audit as never,
    notifications as never,
  );
  return { service, tx, database, courses, locks, audit, notifications, order };
};

describe("EnrollmentApprovalService.approve", () => {
  test("approves, pins the revision, locks, unlocks module 1 and records everything", async () => {
    const { service, tx, locks, audit, notifications, order } = build();

    const result = await service.approve("enrollment-id", actor, "Eligible");

    expect(result).toEqual({
      id: "enrollment-id",
      status: "APPROVED",
      courseRevisionId: "revision-id",
      approvedAt: now.toISOString(),
    });
    expect(tx.enrollment.updateMany).toHaveBeenCalledWith({
      where: { id: "enrollment-id", status: "PENDING_APPROVAL" },
      data: { status: "APPROVED", courseRevisionId: "revision-id", approvedAt: now },
    });
    expect(locks.lockOnFirstApproval).toHaveBeenCalledWith(tx, "course-id", now);
    expect(tx.moduleProgress.createMany).toHaveBeenCalledWith({
      data: [
        { enrollmentId: "enrollment-id", moduleId: "m1", status: "UNLOCKED", unlockedAt: now },
        { enrollmentId: "enrollment-id", moduleId: "m2", status: "LOCKED" },
        { enrollmentId: "enrollment-id", moduleId: "m3", status: "LOCKED" },
      ],
    });
    expect(tx.enrollmentDecision.create).toHaveBeenCalledWith({
      data: {
        enrollmentId: "enrollment-id",
        adminId: "admin-id",
        action: "APPROVE",
        reason: "Eligible",
        decidedAt: now,
      },
    });
    expect(tx.outbox.create).toHaveBeenCalledWith({
      data: {
        eventType: ENROLLMENT_APPROVED_EVENT_TYPE,
        payload: { enrollmentId: "enrollment-id", userId: "user-id", courseId: "course-id" },
      },
    });
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      actor,
      expect.objectContaining({
        action: "enrollment.approve",
        entity: "Enrollment",
        entityId: "enrollment-id",
        before: { status: "PENDING_APPROVAL" },
        after: { status: "APPROVED", courseRevisionId: "revision-id", reason: "Eligible" },
      }),
    );
    expect(notifications.createWithin).toHaveBeenCalledWith(tx, {
      userId: "user-id",
      type: "ENROLLMENT_APPROVED",
      data: { enrollmentId: "enrollment-id", courseId: "course-id" },
    });
    expect(order).toEqual([
      "target",
      "claim",
      "lock",
      "progress",
      "decision",
      "outbox",
      "notify",
      "audit",
    ]);
  });

  test("creates no notification when the approval is refused", async () => {
    const { service, notifications } = build({ status: "APPROVED" });

    await expect(service.approve("enrollment-id", actor)).rejects.toBeDefined();
    expect(notifications.createWithin).not.toHaveBeenCalled();
  });

  test("creates no notification when the transaction fails after the claim", async () => {
    const { service, notifications } = build({ progressFails: true });

    await expect(service.approve("enrollment-id", actor)).rejects.toBeDefined();
    expect(notifications.createWithin).not.toHaveBeenCalled();
  });

  test("stores no reason when none is given", async () => {
    const { service, tx } = build();

    await service.approve("enrollment-id", actor);

    expect(tx.enrollmentDecision.create).toHaveBeenCalledWith({
      data: expect.not.objectContaining({ reason: expect.anything() }),
    });
  });

  test("refuses an unverified request with a stable code and writes nothing", async () => {
    const { service, tx, locks } = build({ status: "PENDING_VERIFICATION" });

    await expect(service.approve("enrollment-id", actor)).rejects.toMatchObject({
      code: "ENROLLMENT_NOT_VERIFIED",
    });
    expect(tx.enrollment.updateMany).not.toHaveBeenCalled();
    expect(locks.lockOnFirstApproval).not.toHaveBeenCalled();
    expect(tx.enrollmentDecision.create).not.toHaveBeenCalled();
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });

  test("reports an unknown request as not found", async () => {
    const { service } = build({ missing: true });

    await expect(service.approve("enrollment-id", actor)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  test("gives the loser of a concurrent approval a conflict and records nothing", async () => {
    const { service, tx, locks } = build({ claimed: 0 });

    const failure = await service.approve("enrollment-id", actor).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiException);
    expect(failure).toMatchObject({ code: "ENROLLMENT_ALREADY_DECIDED" });
    expect((failure as ApiException).getStatus()).toBe(409);
    expect(locks.lockOnFirstApproval).not.toHaveBeenCalled();
    expect(tx.enrollmentDecision.create).not.toHaveBeenCalled();
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });

  test("propagates a failure while unlocking so the transaction rolls back", async () => {
    const { service, tx } = build({ progressFails: true });

    await expect(service.approve("enrollment-id", actor)).rejects.toThrow("unlock failed");
    expect(tx.enrollmentDecision.create).not.toHaveBeenCalled();
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });

  test("propagates a lock failure so the transaction rolls back", async () => {
    const { service, tx } = build({ lockFails: true });

    await expect(service.approve("enrollment-id", actor)).rejects.toThrow("lock failed");
    expect(tx.moduleProgress.createMany).not.toHaveBeenCalled();
  });
});

describe("EnrollmentApprovalService.approveMany", () => {
  test("approves each id in its own transaction and names the failures", async () => {
    const { service, database } = build();
    const approve = vi
      .spyOn(service, "approve")
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new ApiException(409, "ENROLLMENT_ALREADY_DECIDED"))
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({} as never);

    const summary = await service.approveMany(["a", "b", "c", "d"], actor, "ok");

    expect(summary).toEqual({
      succeeded: ["a", "d"],
      failed: [
        { id: "b", code: "ENROLLMENT_ALREADY_DECIDED" },
        { id: "c", code: "INTERNAL" },
      ],
    });
    expect(approve).toHaveBeenCalledTimes(4);
    expect(approve).toHaveBeenCalledWith("a", actor, "ok");
    expect(database.$transaction).not.toHaveBeenCalled();
  });
});

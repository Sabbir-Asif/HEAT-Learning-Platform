import { describe, expect, test, vi } from "vitest";
import {
  ENROLLMENT_REJECTED_EVENT_TYPE,
  EnrollmentRejectionService,
} from "../../src/enrollment/enrollment-rejection.service";

const now = new Date("2026-11-11T05:00:00.000Z");
const actor = { actorId: "admin-id", ipAddress: "203.0.113.4", requestId: "req-1" };

interface Options {
  status?: string;
  claimed?: number;
  statusAfterClaim?: string;
  otherAccess?: number;
  missing?: boolean;
  deleteFails?: boolean;
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
                status: options.status ?? "PENDING_APPROVAL",
                courseId: "course-id",
                userId: "user-id",
              },
        )
        .mockResolvedValue({ status: options.statusAfterClaim ?? "APPROVED" }),
      updateMany: vi.fn().mockResolvedValue({ count: options.claimed ?? 1 }),
      count: vi.fn().mockResolvedValue(options.otherAccess ?? 0),
      delete: vi.fn().mockImplementation(async () => {
        if (options.deleteFails === true) throw new Error("delete failed");
        return {};
      }),
    },
    user: {
      findFirst: vi.fn().mockResolvedValue({ email: "student@du.ac.bd" }),
      delete: vi.fn().mockResolvedValue({}),
    },
    course: { findFirst: vi.fn().mockResolvedValue({ title: "HEAT Basics" }) },
    studentProfile: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    session: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
    enrollmentDecision: { create: vi.fn().mockResolvedValue({}) },
    outbox: { create: vi.fn().mockResolvedValue({}) },
  };
  const database = {
    $transaction: vi.fn().mockImplementation(async (work: (client: unknown) => unknown) => {
      return work(tx);
    }),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const notifications = { createWithin: vi.fn().mockResolvedValue(true) };
  const service = new EnrollmentRejectionService(
    database as never,
    { now: () => now },
    audit as never,
    notifications as never,
  );
  return { service, tx, audit, notifications };
};

describe("EnrollmentRejectionService.reject", () => {
  test("a sole enrollment soft-deletes the enrollment, profile and account and revokes sessions", async () => {
    const { service, tx, audit } = build();

    const result = await service.reject("enrollment-id", actor, "Duplicate request");

    expect(result).toEqual({
      id: "enrollment-id",
      status: "REJECTED",
      rejectedAt: now.toISOString(),
      accountDeleted: true,
    });
    expect(tx.enrollment.updateMany).toHaveBeenCalledWith({
      where: { id: "enrollment-id", status: "PENDING_APPROVAL" },
      data: { status: "REJECTED", rejectedAt: now },
    });
    expect(tx.enrollment.delete).toHaveBeenCalledWith({ where: { id: "enrollment-id" } });
    expect(tx.studentProfile.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-id" } });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: "user-id" } });
    expect(tx.session.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-id", revokedAt: null },
      data: { revokedAt: now },
    });
    expect(tx.enrollmentDecision.create).toHaveBeenCalledWith({
      data: {
        enrollmentId: "enrollment-id",
        adminId: "admin-id",
        action: "REJECT",
        reason: "Duplicate request",
        decidedAt: now,
      },
    });
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      actor,
      expect.objectContaining({
        action: "enrollment.reject",
        entity: "Enrollment",
        entityId: "enrollment-id",
        before: { status: "PENDING_APPROVAL" },
      }),
    );
  });

  test("counts only other approved or completed enrollments of the same user", async () => {
    const { service, tx } = build();

    await service.reject("enrollment-id", actor);

    expect(tx.enrollment.count).toHaveBeenCalledWith({
      where: {
        userId: "user-id",
        id: { not: "enrollment-id" },
        status: { in: ["APPROVED", "COMPLETED"] },
      },
    });
  });

  test("creates no notification when the account is deleted", async () => {
    const { service, notifications } = build({ otherAccess: 0 });

    await service.reject("enrollment-id", actor);

    expect(notifications.createWithin).not.toHaveBeenCalled();
  });

  test("notifies a student whose account is kept", async () => {
    const { service, tx, notifications } = build({ otherAccess: 1 });

    await service.reject("enrollment-id", actor);

    expect(notifications.createWithin).toHaveBeenCalledWith(tx, {
      userId: "user-id",
      type: "ENROLLMENT_REJECTED",
      data: { enrollmentId: "enrollment-id", courseId: expect.any(String) },
    });
  });

  test("keeps the account and sessions when the student has other access", async () => {
    const { service, tx } = build({ otherAccess: 1 });

    const result = await service.reject("enrollment-id", actor);

    expect(result.accountDeleted).toBe(false);
    expect(tx.enrollment.delete).toHaveBeenCalledTimes(1);
    expect(tx.user.delete).not.toHaveBeenCalled();
    expect(tx.studentProfile.deleteMany).not.toHaveBeenCalled();
    expect(tx.session.updateMany).not.toHaveBeenCalled();
  });

  test("writes the outbox row with a copy of the recipient address", async () => {
    const { service, tx } = build();

    await service.reject("enrollment-id", actor, "Duplicate request");

    expect(tx.outbox.create).toHaveBeenCalledWith({
      data: {
        eventType: ENROLLMENT_REJECTED_EVENT_TYPE,
        payload: {
          enrollmentId: "enrollment-id",
          userId: "user-id",
          courseId: "course-id",
          template: "enrollment-rejected",
          courseTitle: "HEAT Basics",
          recipientAddress: "student@du.ac.bd",
          reason: "Duplicate request",
        },
      },
    });
  });

  test("omits the reason from the decision and outbox when none is given", async () => {
    const { service, tx } = build();

    await service.reject("enrollment-id", actor);

    expect(tx.enrollmentDecision.create.mock.calls[0]?.[0].data).not.toHaveProperty("reason");
    expect(tx.outbox.create.mock.calls[0]?.[0].data.payload).not.toHaveProperty("reason");
  });

  test("refuses a request another admin already decided and changes nothing", async () => {
    const { service, tx } = build({ status: "APPROVED" });

    await expect(service.reject("enrollment-id", actor)).rejects.toMatchObject({
      code: "ENROLLMENT_ALREADY_DECIDED",
    });
    expect(tx.enrollment.updateMany).not.toHaveBeenCalled();
    expect(tx.user.delete).not.toHaveBeenCalled();
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });

  test("returns a conflict when the claim is lost to a concurrent decision", async () => {
    const { service, tx } = build({ claimed: 0 });

    await expect(service.reject("enrollment-id", actor)).rejects.toMatchObject({
      status: 409,
      code: "ENROLLMENT_ALREADY_DECIDED",
    });
    expect(tx.user.delete).not.toHaveBeenCalled();
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });

  test("refuses an unverified request", async () => {
    const { service } = build({ status: "PENDING_VERIFICATION" });

    await expect(service.reject("enrollment-id", actor)).rejects.toMatchObject({
      code: "ENROLLMENT_NOT_VERIFIED",
    });
  });

  test("answers not found for a missing enrollment", async () => {
    const { service } = build({ missing: true });

    await expect(service.reject("enrollment-id", actor)).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });
});

describe("EnrollmentRejectionService.rejectMany", () => {
  test("commits the others and names the failed item", async () => {
    const { service, tx } = build();
    tx.enrollment.findFirst.mockReset();
    tx.enrollment.findFirst
      .mockResolvedValueOnce({ id: "a", status: "PENDING_APPROVAL", courseId: "c", userId: "u" })
      .mockResolvedValueOnce({ id: "b", status: "APPROVED", courseId: "c", userId: "u2" })
      .mockResolvedValueOnce({ id: "c", status: "PENDING_APPROVAL", courseId: "c", userId: "u3" });

    const summary = await service.rejectMany(["a", "b", "c"], actor, "no");

    expect(summary).toEqual({
      succeeded: ["a", "c"],
      failed: [{ id: "b", code: "ENROLLMENT_ALREADY_DECIDED" }],
    });
  });

  test("reports an unexpected failure as INTERNAL", async () => {
    const { service } = build({ deleteFails: true });

    const summary = await service.rejectMany(["a"], actor);

    expect(summary.failed).toEqual([{ id: "a", code: "INTERNAL" }]);
  });
});

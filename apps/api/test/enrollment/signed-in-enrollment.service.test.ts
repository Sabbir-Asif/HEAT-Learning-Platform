import { describe, expect, test, vi } from "vitest";
import { ApiException } from "../../src/http/api-exception";
import { ENROLLMENT_REQUESTED_EVENT_TYPE } from "../../src/enrollment/enrollment.service";
import { SignedInEnrollmentService } from "../../src/enrollment/signed-in-enrollment.service";

interface Existing {
  id: string;
  status: string;
  deletedAt: Date | null;
  approvedAt: Date | null;
}

const build = (
  options: { verified?: boolean; existing?: Existing | null; user?: boolean } = {},
) => {
  const { verified = true, existing = null, user = true } = options;
  const tx = {
    user: {
      findFirst: vi
        .fn()
        .mockResolvedValue(user ? { emailVerifiedAt: verified ? new Date() : null } : null),
    },
    enrollment: {
      findUnique: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockResolvedValue({ id: "new-id" }),
      update: vi.fn().mockResolvedValue({ id: "old-id" }),
    },
    outbox: { create: vi.fn().mockResolvedValue({}) },
    course: {},
  };
  const database = {
    $transaction: vi
      .fn()
      .mockImplementation(async (work: (client: unknown) => unknown) => work(tx)),
  };
  const courses = { resolveOpenForEnrollment: vi.fn().mockResolvedValue({ id: "course-id" }) };
  const service = new SignedInEnrollmentService(database as never, courses as never);
  return { service, tx, database, courses };
};

const body = { courseSlug: "gender-safety" };

describe("SignedInEnrollmentService.request", () => {
  test("creates a pending approval enrollment and an outbox event", async () => {
    const { service, tx } = build();

    const result = await service.request("user-id", body);

    expect(result).toEqual({
      enrollmentId: "new-id",
      courseSlug: "gender-safety",
      status: "PENDING_APPROVAL",
    });
    expect(tx.enrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-id",
          courseId: "course-id",
          status: "PENDING_APPROVAL",
        }),
      }),
    );
    expect(tx.outbox.create).toHaveBeenCalledWith({
      data: {
        eventType: ENROLLMENT_REQUESTED_EVENT_TYPE,
        payload: { userId: "user-id", enrollmentId: "new-id", courseId: "course-id" },
      },
    });
  });

  test("refuses an unverified email", async () => {
    const { service, tx } = build({ verified: false });

    await expect(service.request("user-id", body)).rejects.toMatchObject({
      code: "EMAIL_NOT_VERIFIED",
    });
    expect(tx.enrollment.create).not.toHaveBeenCalled();
  });

  test("refuses an unknown or inactive account", async () => {
    const { service } = build({ user: false });

    await expect(service.request("user-id", body)).rejects.toBeInstanceOf(ApiException);
  });

  test("returns the current status without creating a second enrollment", async () => {
    const { service, tx } = build({
      existing: { id: "old-id", status: "REJECTED", deletedAt: null, approvedAt: null },
    });

    const result = await service.request("user-id", body);

    expect(result.status).toBe("REJECTED");
    expect(result.enrollmentId).toBe("old-id");
    expect(tx.enrollment.create).not.toHaveBeenCalled();
    expect(tx.enrollment.update).not.toHaveBeenCalled();
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });

  test("reopens a soft-deleted enrollment that was never approved", async () => {
    const { service, tx } = build({
      existing: { id: "old-id", status: "REJECTED", deletedAt: new Date(), approvedAt: null },
    });

    const result = await service.request("user-id", body);

    expect(result).toEqual({
      enrollmentId: "old-id",
      courseSlug: "gender-safety",
      status: "PENDING_APPROVAL",
    });
    expect(tx.enrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "old-id" },
        data: expect.objectContaining({ status: "PENDING_APPROVAL", deletedAt: null }),
      }),
    );
    expect(tx.enrollment.create).not.toHaveBeenCalled();
    expect(tx.outbox.create).toHaveBeenCalledTimes(1);
  });

  test("does not reopen a soft-deleted enrollment that was approved", async () => {
    const { service, tx } = build({
      existing: {
        id: "old-id",
        status: "REMOVED",
        deletedAt: new Date(),
        approvedAt: new Date(),
      },
    });

    await expect(service.request("user-id", body)).rejects.toMatchObject({
      code: "ENROLLMENT_ALREADY_DECIDED",
    });
    expect(tx.enrollment.update).not.toHaveBeenCalled();
  });

  test("retries once and returns the winner when a concurrent click violates the unique index", async () => {
    const { service, database, tx } = build();
    tx.enrollment.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "winner-id",
      status: "PENDING_APPROVAL",
      deletedAt: null,
      approvedAt: null,
    });
    tx.enrollment.create.mockRejectedValueOnce({ code: "P2002" });

    const result = await service.request("user-id", body);

    expect(database.$transaction).toHaveBeenCalledTimes(2);
    expect(result.enrollmentId).toBe("winner-id");
  });

  test("rethrows other database errors", async () => {
    const { service, tx } = build();
    tx.enrollment.create.mockRejectedValueOnce(new Error("down"));

    await expect(service.request("user-id", body)).rejects.toThrow("down");
  });
});

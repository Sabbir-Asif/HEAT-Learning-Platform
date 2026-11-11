import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, test, vi } from "vitest";
import { MeController } from "../../src/me/me.controller";
import { MeService } from "../../src/me/me.service";
import { deriveVerificationEmail } from "../../src/me/verification-email";

const user = {
  id: "user-id",
  email: "learner@example.test",
  role: "STUDENT",
  emailVerifiedAt: new Date("2026-11-01T00:00:00.000Z"),
  mustChangePassword: false,
  profile: { name: "Learner" },
};

const course = { id: "course-id", slug: "heat", title: "HEAT" };

const build = (userRow: unknown, enrollments: unknown[] = [], job: unknown = null) => {
  const database = {
    user: { findFirst: vi.fn().mockResolvedValue(userRow) },
    enrollment: { findMany: vi.fn().mockResolvedValue(enrollments) },
    emailJob: { findFirst: vi.fn().mockResolvedValue(job) },
  };
  return { service: new MeService(database as never), database };
};

describe("MeService.describe", () => {
  test("rejects a user that is missing, deleted or deactivated", async () => {
    const { service, database } = build(null);

    await expect(service.describe("user-id")).rejects.toBeInstanceOf(UnauthorizedException);
    expect(database.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-id", deletedAt: null, deactivatedAt: null } }),
    );
    expect(database.enrollment.findMany).not.toHaveBeenCalled();
  });

  test("maps the account and each enrollment with the latest decision reason", async () => {
    const { service } = build(user, [
      { status: "REJECTED", course, decisions: [{ reason: "Incomplete form" }] },
      { status: "APPROVED", course, decisions: [] },
    ]);

    expect(await service.describe("user-id")).toEqual({
      user: {
        id: "user-id",
        email: "learner@example.test",
        name: "Learner",
        role: "STUDENT",
        emailVerified: true,
        mustChangePassword: false,
      },
      enrollments: [
        {
          courseId: "course-id",
          courseSlug: "heat",
          courseTitle: "HEAT",
          status: "REJECTED",
          reason: "Incomplete form",
        },
        {
          courseId: "course-id",
          courseSlug: "heat",
          courseTitle: "HEAT",
          status: "APPROVED",
          reason: undefined,
        },
      ],
      verificationEmail: null,
      verificationEmailSentAt: null,
    });
  });

  test("reports an unverified account without a profile", async () => {
    const { service } = build({ ...user, emailVerifiedAt: null, profile: null });

    const result = await service.describe("user-id");

    expect(result.user.emailVerified).toBe(false);
    expect(result.user.name).toBeUndefined();
    expect(result.enrollments).toEqual([]);
    expect(result.verificationEmail).toBe("ON_ITS_WAY");
  });

  test("reports the sent time of a sent verification email", async () => {
    const sentAt = new Date("2026-11-02T08:30:00.000Z");
    const { service, database } = build({ ...user, emailVerifiedAt: null }, [], {
      status: "SENT",
      sentAt,
    });

    const result = await service.describe("user-id");

    expect(result.verificationEmail).toBe("SENT");
    expect(result.verificationEmailSentAt).toBe("2026-11-02T08:30:00.000Z");
    expect(database.emailJob.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-id", category: "VERIFICATION", template: "student-verification" },
        orderBy: { queuedAt: "desc" },
      }),
    );
  });

  test("does not look up the email job for a verified account", async () => {
    const { service, database } = build(user);

    await service.describe("user-id");

    expect(database.emailJob.findFirst).not.toHaveBeenCalled();
  });
});

describe("deriveVerificationEmail", () => {
  const unverified = null;
  const sentAt = new Date("2026-11-02T08:30:00.000Z");

  test("is null once verified", () => {
    expect(deriveVerificationEmail(new Date(), { status: "SENT", sentAt })).toEqual({
      status: null,
      sentAt: null,
    });
  });

  test("maps SENT with its time and FAILED without one", () => {
    expect(deriveVerificationEmail(unverified, { status: "SENT", sentAt })).toEqual({
      status: "SENT",
      sentAt,
    });
    expect(deriveVerificationEmail(unverified, { status: "FAILED", sentAt: null })).toEqual({
      status: "FAILED",
      sentAt: null,
    });
  });

  test.each(["QUEUED", "DELAYED", "SENDING"] as const)("treats %s as on its way", (status) => {
    expect(deriveVerificationEmail(unverified, { status, sentAt: null }).status).toBe("ON_ITS_WAY");
  });

  test("treats no job yet as on its way", () => {
    expect(deriveVerificationEmail(unverified, null)).toEqual({
      status: "ON_ITS_WAY",
      sentAt: null,
    });
  });
});

describe("MeController.describe", () => {
  test("describes the signed-in user", async () => {
    const describe = vi.fn().mockResolvedValue({ user: { id: "user-id" }, enrollments: [] });
    const controller = new MeController({ describe } as never);

    await controller.describe({ userId: "user-id", familyId: "family" } as never);

    expect(describe).toHaveBeenCalledWith("user-id");
  });
});

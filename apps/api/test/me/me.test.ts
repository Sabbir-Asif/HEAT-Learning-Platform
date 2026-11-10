import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, test, vi } from "vitest";
import { MeController } from "../../src/me/me.controller";
import { MeService } from "../../src/me/me.service";

const user = {
  id: "user-id",
  email: "learner@example.test",
  role: "STUDENT",
  emailVerifiedAt: new Date("2026-11-01T00:00:00.000Z"),
  mustChangePassword: false,
  profile: { name: "Learner" },
};

const course = { id: "course-id", slug: "heat", title: "HEAT" };

const build = (userRow: unknown, enrollments: unknown[] = []) => {
  const database = {
    user: { findFirst: vi.fn().mockResolvedValue(userRow) },
    enrollment: { findMany: vi.fn().mockResolvedValue(enrollments) },
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
    });
  });

  test("reports an unverified account without a profile", async () => {
    const { service } = build({ ...user, emailVerifiedAt: null, profile: null });

    const result = await service.describe("user-id");

    expect(result.user.emailVerified).toBe(false);
    expect(result.user.name).toBeUndefined();
    expect(result.enrollments).toEqual([]);
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

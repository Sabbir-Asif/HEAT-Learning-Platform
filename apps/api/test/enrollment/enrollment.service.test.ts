import { describe, expect, test, vi } from "vitest";
import { ApiException } from "../../src/http/api-exception";
import {
  ENROLLMENT_REQUESTED_EVENT_TYPE,
  EnrollmentService,
} from "../../src/enrollment/enrollment.service";

const request = {
  name: "Anne Smith",
  universityId: "7b1c1d2e-3f4a-4b5c-8d6e-9f0a1b2c3d4e",
  facultyId: "8c2d2e3f-4a5b-4c6d-9e7f-0a1b2c3d4e5f",
  departmentId: "9d3e3f4a-5b6c-4d7e-8f80-1b2c3d4e5f60",
  session: "2020-21",
  email: "anne@example.com",
  password: "correct horse battery",
  confirmPassword: "correct horse battery",
  captchaId: "1b4e28ba-2fa1-41d2-883f-0016d3cca427",
  captchaAnswer: "AB12",
  courseSlug: "gender-safety",
};
const actor = { actorId: null, ipAddress: "203.0.113.4" };

const build = (outcome: unknown = { kind: "PROCEED", replacedUserId: null }) => {
  const order: string[] = [];
  const tx = {
    user: {
      create: vi.fn().mockImplementation(async () => {
        order.push("user");
        return { id: "user-id", createdAt: new Date("2026-11-01T00:00:00.000Z") };
      }),
    },
    studentProfile: {
      create: vi.fn().mockImplementation(async () => {
        order.push("profile");
        return {};
      }),
    },
    enrollment: {
      create: vi.fn().mockImplementation(async () => {
        order.push("enrollment");
        return { id: "enrollment-id" };
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
    $transaction: vi
      .fn()
      .mockImplementation(async (work: (client: unknown) => unknown) => work(tx)),
  };
  const captcha = {
    verify: vi.fn().mockImplementation(async () => {
      order.push("captcha");
    }),
  };
  const passwords = {
    assertNotBreached: vi.fn().mockImplementation(async () => {
      order.push("breach");
    }),
    hash: vi.fn().mockImplementation(async () => {
      order.push("hash");
      return "argon-digest";
    }),
  };
  const courses = {
    resolveOpenForEnrollment: vi.fn().mockImplementation(async () => {
      order.push("course");
      return { id: "course-id" };
    }),
  };
  const departments = {
    assertDepartmentOfferable: vi.fn().mockImplementation(async () => {
      order.push("directory");
    }),
  };
  const policy = {
    apply: vi.fn().mockImplementation(async () => {
      order.push("policy");
      return outcome;
    }),
  };
  const timing = { equalise: vi.fn().mockImplementation((work: () => unknown) => work()) };
  const verification = {
    issue: vi.fn().mockImplementation(async () => {
      order.push("token");
      return { encryptedToken: "sealed-token", expiresAt: new Date("2026-11-03T00:00:00.000Z") };
    }),
  };
  const service = new EnrollmentService(
    database as never,
    captcha as never,
    passwords as never,
    courses as never,
    departments as never,
    policy as never,
    timing as never,
    verification as never,
  );
  return {
    service,
    tx,
    database,
    captcha,
    passwords,
    courses,
    departments,
    policy,
    timing,
    verification,
    order,
  };
};

describe("EnrollmentService.submit", () => {
  test("writes user, profile, enrollment and outbox row in one transaction", async () => {
    const { service, tx, database, order } = build();

    expect(await service.submit(request, actor)).toEqual({ accepted: true });

    expect(database.$transaction).toHaveBeenCalledTimes(1);
    expect(order).toEqual([
      "captcha",
      "breach",
      "hash",
      "course",
      "directory",
      "policy",
      "user",
      "profile",
      "enrollment",
      "token",
      "outbox",
    ]);
    expect(tx.user.create).toHaveBeenCalledWith({
      data: {
        email: "anne@example.com",
        passwordHash: "argon-digest",
        role: "STUDENT",
        realm: "STUDENT",
      },
      select: { id: true, createdAt: true },
    });
    expect(tx.studentProfile.create).toHaveBeenCalledWith({
      data: {
        userId: "user-id",
        name: "Anne Smith",
        departmentId: request.departmentId,
        session: "2020-21",
      },
    });
    expect(tx.enrollment.create).toHaveBeenCalledWith({
      data: { userId: "user-id", courseId: "course-id", status: "PENDING_VERIFICATION" },
      select: { id: true },
    });
    expect(tx.outbox.create).toHaveBeenCalledWith({
      data: {
        eventType: ENROLLMENT_REQUESTED_EVENT_TYPE,
        payload: {
          userId: "user-id",
          enrollmentId: "enrollment-id",
          courseId: "course-id",
          template: "student-verification",
          encryptedToken: "sealed-token",
        },
      },
    });
  });

  test("issues the verification token for the new user inside the same transaction", async () => {
    const { service, tx, verification } = build();

    await service.submit(request, actor);

    expect(verification.issue).toHaveBeenCalledWith(tx, {
      id: "user-id",
      createdAt: new Date("2026-11-01T00:00:00.000Z"),
    });
  });

  test("never stores or queues the plain password", async () => {
    const { service, tx } = build();

    await service.submit(request, actor);

    const written = JSON.stringify([
      tx.user.create.mock.calls,
      tx.studentProfile.create.mock.calls,
      tx.enrollment.create.mock.calls,
      tx.outbox.create.mock.calls,
    ]);
    expect(written).not.toContain(request.password);
  });

  test("checks the directory chain and the course inside the transaction", async () => {
    const { service, tx, courses, departments } = build();

    await service.submit(request, actor);

    expect(courses.resolveOpenForEnrollment).toHaveBeenCalledWith("gender-safety", tx);
    expect(departments.assertDepartmentOfferable).toHaveBeenCalledWith(request.departmentId, tx, {
      universityId: request.universityId,
      facultyId: request.facultyId,
    });
  });

  test("answers an existing account exactly like a new one and writes nothing", async () => {
    const { service, tx } = build({ kind: "ALREADY_REGISTERED", userId: "other" });

    expect(await service.submit(request, actor)).toEqual({ accepted: true });

    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.studentProfile.create).not.toHaveBeenCalled();
    expect(tx.enrollment.create).not.toHaveBeenCalled();
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });

  test("hashes the password even for an existing account so timing matches", async () => {
    const { service, passwords } = build({ kind: "ALREADY_REGISTERED", userId: "other" });

    await service.submit(request, actor);

    expect(passwords.hash).toHaveBeenCalledWith(request.password);
  });

  test("runs the hash and transaction under the response timing floor", async () => {
    const { service, timing } = build();

    await service.submit(request, actor);

    expect(timing.equalise).toHaveBeenCalledTimes(1);
  });

  test("treats a lost race on the unique email as an existing account", async () => {
    const { service, database } = build();
    database.$transaction.mockRejectedValue({ code: "P2002", meta: { target: ["email"] } });

    expect(await service.submit(request, actor)).toEqual({ accepted: true });
  });

  test("lets other database failures through", async () => {
    const { service, database } = build();
    database.$transaction.mockRejectedValue(new Error("connection lost"));

    await expect(service.submit(request, actor)).rejects.toThrow("connection lost");
  });

  test("rolls back by throwing when a write fails after the user row", async () => {
    const { service, tx, database } = build();
    tx.studentProfile.create.mockRejectedValue(new Error("write failed"));

    await expect(service.submit(request, actor)).rejects.toThrow("write failed");

    expect(database.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.enrollment.create).not.toHaveBeenCalled();
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });

  test("refuses an unknown or unpublished course before any write", async () => {
    const { service, tx, courses, policy } = build();
    courses.resolveOpenForEnrollment.mockRejectedValue(
      new ApiException(404, "COURSE_NOT_AVAILABLE"),
    );

    await expect(service.submit(request, actor)).rejects.toMatchObject({
      code: "COURSE_NOT_AVAILABLE",
    });
    expect(policy.apply).not.toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  test("refuses a department outside the chosen university and faculty", async () => {
    const { service, tx, departments } = build();
    departments.assertDepartmentOfferable.mockRejectedValue(
      new ApiException(400, "VALIDATION_FAILED"),
    );

    await expect(service.submit(request, actor)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  test("does not check the password or open a transaction when the captcha fails", async () => {
    const { service, captcha, passwords, database } = build();
    captcha.verify.mockRejectedValue(new ApiException(400, "CAPTCHA_INVALID"));

    await expect(service.submit(request, actor)).rejects.toMatchObject({
      code: "CAPTCHA_INVALID",
    });
    expect(passwords.assertNotBreached).not.toHaveBeenCalled();
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  test("rejects a breached password before hashing", async () => {
    const { service, passwords } = build();
    passwords.assertNotBreached.mockRejectedValue(new ApiException(400, "PASSWORD_BREACHED"));

    await expect(service.submit(request, actor)).rejects.toMatchObject({
      code: "PASSWORD_BREACHED",
    });
    expect(passwords.hash).not.toHaveBeenCalled();
  });
});

import { describe, expect, test } from "vitest";
import { SessionService, realmCookies } from "../../src/auth";
import { AccessProbeController } from "../support/access-probe.controller";
import { useTestApp } from "../support/testing-module";

type EnrollmentStatus =
  | "PENDING_VERIFICATION"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "COMPLETED"
  | "REJECTED"
  | "EXPIRED"
  | "REMOVED";

describe("access guards over HTTP", () => {
  const testApp = useTestApp({ controllers: [AccessProbeController] });

  const cookieFor = async (realm: "student" | "admin", userId: string): Promise<string> => {
    const tokens = await testApp().moduleRef.get(SessionService).create(userId, realm);
    return `${realmCookies[realm].access}=${tokens.accessToken}`;
  };

  const get = async (path: string, cookie?: string) => {
    const response = await fetch(`${testApp().baseUrl}/api${path}`, {
      headers: cookie === undefined ? {} : { cookie },
    });
    const text = await response.text();
    return {
      status: response.status,
      body: text === "" ? undefined : (JSON.parse(text) as { error?: { code: string } }),
    };
  };

  const studentWithEnrollment = async (status: EnrollmentStatus) => {
    const { factories } = testApp();
    const { user } = await factories.student();
    const { course } = await factories.course({ published: true });
    const removed = status === "REMOVED";
    const enrollment = await factories.enrollment({
      userId: user.id,
      courseId: course.id,
      status: removed ? "APPROVED" : status,
    });
    if (removed) {
      await testApp().database.prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { status: "REMOVED", statusBeforeRemoval: "APPROVED", removedAt: new Date() },
      });
    }
    return { user, course, enrollment, cookie: await cookieFor("student", user.id) };
  };

  test("a route with no access metadata is refused even for a signed-in student", async () => {
    const { user } = await testApp().factories.student();

    const reply = await get("/probe/unannotated", await cookieFor("student", user.id));

    expect(reply.status).toBe(403);
    expect(reply.body?.error?.code).toBe("FORBIDDEN");
  });

  test("a public route answers without a session", async () => {
    expect((await get("/health")).status).toBe(200);
  });

  test("missing and invalid sessions are 401", async () => {
    expect((await get("/probe/student")).status).toBe(401);
    expect((await get("/probe/student", `${realmCookies.student.access}=not-a-token`)).status).toBe(
      401,
    );
    expect((await get("/probe/admin")).status).toBe(401);
  });

  test("a valid student session on an admin route is 403 FORBIDDEN", async () => {
    const { user } = await testApp().factories.student();

    const reply = await get("/probe/admin", await cookieFor("student", user.id));

    expect(reply.status).toBe(403);
    expect(reply.body?.error?.code).toBe("FORBIDDEN");
  });

  test("a valid admin session on a student route is 403 FORBIDDEN", async () => {
    const admin = await testApp().factories.admin();

    const reply = await get("/probe/student", await cookieFor("admin", admin.id));

    expect(reply.status).toBe(403);
    expect(reply.body?.error?.code).toBe("FORBIDDEN");
  });

  test("the student cookie sent as the admin cookie is not accepted", async () => {
    const { user } = await testApp().factories.student();
    const tokens = await testApp().moduleRef.get(SessionService).create(user.id, "student");

    const reply = await get("/probe/admin", `${realmCookies.admin.access}=${tokens.accessToken}`);

    expect(reply.status).toBe(401);
  });

  test("a student and an admin each reach their own route", async () => {
    const { user } = await testApp().factories.student();
    const admin = await testApp().factories.admin();

    const student = await get("/probe/student", await cookieFor("student", user.id));
    const staff = await get("/probe/admin", await cookieFor("admin", admin.id));

    expect(student).toEqual({ status: 200, body: { role: "STUDENT" } });
    expect(staff).toEqual({ status: 200, body: { role: "ADMIN" } });
  });

  test("an ADMIN is refused a SUPER_ADMIN-only route", async () => {
    const admin = await testApp().factories.admin();

    expect((await get("/probe/super-admin", await cookieFor("admin", admin.id))).status).toBe(403);
  });

  test.each([
    "PENDING_VERIFICATION",
    "PENDING_APPROVAL",
    "REJECTED",
    "EXPIRED",
    "REMOVED",
  ] as const)("a %s enrollment is refused with ENROLLMENT_NOT_ACTIVE", async (status) => {
    const { course, cookie } = await studentWithEnrollment(status);

    const reply = await get(`/probe/courses/${course.id}/content`, cookie);

    expect(reply.status).toBe(403);
    expect(reply.body?.error?.code).toBe("ENROLLMENT_NOT_ACTIVE");
  });

  test.each(["APPROVED", "COMPLETED"] as const)("a %s enrollment is allowed", async (status) => {
    const { course, cookie } = await studentWithEnrollment(status);

    const reply = await get(`/probe/courses/${course.id}/content`, cookie);

    expect(reply).toEqual({ status: 200, body: { courseId: course.id } });
  });

  test("removal takes effect on the next call with the same session", async () => {
    const { course, enrollment, cookie } = await studentWithEnrollment("APPROVED");
    expect((await get(`/probe/courses/${course.id}/content`, cookie)).status).toBe(200);

    await testApp().database.prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { status: "REMOVED", statusBeforeRemoval: "APPROVED", removedAt: new Date() },
    });

    const reply = await get(`/probe/courses/${course.id}/content`, cookie);
    expect(reply.status).toBe(403);
    expect(reply.body?.error?.code).toBe("ENROLLMENT_NOT_ACTIVE");
  });

  test("a course the student is not enrolled in, or a malformed id, is refused the same way", async () => {
    const { cookie } = await studentWithEnrollment("APPROVED");
    const other = await testApp().factories.course({ published: true });

    const notEnrolled = await get(`/probe/courses/${other.course.id}/content`, cookie);
    const malformed = await get("/probe/courses/not-a-uuid/content", cookie);

    expect(notEnrolled.status).toBe(403);
    expect(notEnrolled.body?.error?.code).toBe("ENROLLMENT_NOT_ACTIVE");
    expect(malformed.status).toBe(403);
    expect(malformed.body?.error?.code).toBe("ENROLLMENT_NOT_ACTIVE");
  });

  test("routing is case sensitive and strict", async () => {
    expect((await get("/HEALTH")).status).toBe(404);
    expect((await get("/health/")).status).toBe(404);
    expect((await get("/health")).status).toBe(200);
  });
});

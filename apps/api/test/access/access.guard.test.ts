import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, test, vi } from "vitest";
import { AccessGuard } from "../../src/access/access.guard";
import { Audience, RequireCourseAccess, Roles } from "../../src/access/access.decorators";
import type { EnrollmentAccessService } from "../../src/access/enrollment-access.service";
import type { AuthenticatedSession, AuthRealm, UserRoleName } from "../../src/auth/auth.types";
import type { AuthenticatedRequest } from "../../src/auth/authenticated-request";
import { Public } from "../../src/auth/public.decorator";
import type { SessionService } from "../../src/auth/session.service";
import { ApiException } from "../../src/http/api-exception";

class Bare {
  handler(): void {}
}

class Open {
  @Public()
  handler(): void {}
}

class StudentRoute {
  @Audience("student")
  handler(): void {}
}

class StudentCourseRoute {
  @Audience("student")
  @RequireCourseAccess("courseId")
  handler(): void {}
}

class AdminOnlyRoute {
  @Audience("admin")
  @Roles("ADMIN")
  handler(): void {}
}

class AdminBothRoute {
  @Audience("admin")
  @Roles("ADMIN", "SUPER_ADMIN")
  handler(): void {}
}

const cookies: Record<AuthRealm, string> = {
  student: "__Host-heat_access=student-token",
  admin: "__Host-heat_admin_access=admin-token",
};

const sessionFor = (realm: AuthRealm, role: UserRoleName): AuthenticatedSession => ({
  userId: "user-1",
  familyId: "family-1",
  realm,
  role,
});

type Request = AuthenticatedRequest & { params?: Record<string, string> };

const contextFor = (controller: new () => object, request: Request): ExecutionContext =>
  ({
    getHandler: () => Reflect.get(controller.prototype, "handler") as () => void,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

interface Harness {
  guard: AccessGuard;
  authenticate: ReturnType<typeof vi.fn>;
  hasActiveEnrollment: ReturnType<typeof vi.fn>;
}

const build = (
  valid: Partial<Record<AuthRealm, AuthenticatedSession>>,
  enrollmentStatus?: EnrollmentStatus,
): Harness => {
  const authenticate = vi.fn((token: string, realm: AuthRealm) => {
    const expected = realm === "student" ? "student-token" : "admin-token";
    const session = valid[realm];
    return token === expected && session !== undefined
      ? Promise.resolve(session)
      : Promise.reject(new UnauthorizedException());
  });
  const hasActiveEnrollment = vi.fn(() =>
    Promise.resolve(enrollmentStatus === "APPROVED" || enrollmentStatus === "COMPLETED"),
  );
  const guard = new AccessGuard(
    new Reflector(),
    { authenticate } as unknown as SessionService,
    { hasActiveEnrollment } as unknown as EnrollmentAccessService,
  );
  return { guard, authenticate, hasActiveEnrollment };
};

type EnrollmentStatus =
  | "PENDING_VERIFICATION"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "COMPLETED"
  | "REJECTED"
  | "EXPIRED"
  | "REMOVED";

describe("AccessGuard", () => {
  test("denies a route with no access metadata with 403, without touching sessions", async () => {
    const { guard, authenticate } = build({ student: sessionFor("student", "STUDENT") });

    await expect(
      guard.canActivate(contextFor(Bare, { headers: { cookie: cookies.student } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(authenticate).not.toHaveBeenCalled();
  });

  test("lets a public route through without a cookie", async () => {
    const { guard, authenticate } = build({});

    await expect(guard.canActivate(contextFor(Open, { headers: {} }))).resolves.toBe(true);
    expect(authenticate).not.toHaveBeenCalled();
  });

  describe("audience by role", () => {
    const rows: Array<{
      route: new () => object;
      cookieRealm: AuthRealm;
      role: UserRoleName;
      outcome: "allow" | "forbidden";
    }> = [
      { route: StudentRoute, cookieRealm: "student", role: "STUDENT", outcome: "allow" },
      { route: AdminOnlyRoute, cookieRealm: "admin", role: "ADMIN", outcome: "allow" },
      { route: AdminOnlyRoute, cookieRealm: "admin", role: "SUPER_ADMIN", outcome: "forbidden" },
      { route: AdminBothRoute, cookieRealm: "admin", role: "SUPER_ADMIN", outcome: "allow" },
      { route: AdminBothRoute, cookieRealm: "admin", role: "ADMIN", outcome: "allow" },
      { route: AdminBothRoute, cookieRealm: "student", role: "STUDENT", outcome: "forbidden" },
      { route: StudentRoute, cookieRealm: "admin", role: "ADMIN", outcome: "forbidden" },
      { route: StudentRoute, cookieRealm: "admin", role: "SUPER_ADMIN", outcome: "forbidden" },
    ];

    test.each(rows)(
      "$route.name with a $cookieRealm session as $role is $outcome",
      async ({ route, cookieRealm, role, outcome }) => {
        const { guard } = build({ [cookieRealm]: sessionFor(cookieRealm, role) });
        const request: Request = { headers: { cookie: cookies[cookieRealm] } };

        const result = guard.canActivate(contextFor(route, request));

        if (outcome === "allow") {
          await expect(result).resolves.toBe(true);
          expect(request.authSession?.role).toBe(role);
        } else {
          await expect(result).rejects.toBeInstanceOf(ForbiddenException);
          expect(request.authSession).toBeUndefined();
        }
      },
    );
  });

  test("a missing cookie is 401", async () => {
    const { guard } = build({});

    await expect(
      guard.canActivate(contextFor(StudentRoute, { headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  test("an invalid cookie of the right realm is 401", async () => {
    const { guard } = build({});

    await expect(
      guard.canActivate(contextFor(StudentRoute, { headers: { cookie: cookies.student } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  test("a valid session of the other realm on a route of this audience is 403", async () => {
    const { guard } = build({ student: sessionFor("student", "STUDENT") });

    await expect(
      guard.canActivate(contextFor(AdminOnlyRoute, { headers: { cookie: cookies.student } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  test("an invalid session of the other realm only is 401", async () => {
    const { guard } = build({});

    await expect(
      guard.canActivate(contextFor(AdminOnlyRoute, { headers: { cookie: cookies.student } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  describe("course access by enrollment status", () => {
    const statuses: EnrollmentStatus[] = [
      "PENDING_VERIFICATION",
      "PENDING_APPROVAL",
      "APPROVED",
      "COMPLETED",
      "REJECTED",
      "EXPIRED",
      "REMOVED",
    ];

    test.each(statuses)("status %s", async (status) => {
      const { guard, hasActiveEnrollment } = build(
        { student: sessionFor("student", "STUDENT") },
        status,
      );
      const request: Request = {
        headers: { cookie: cookies.student },
        params: { courseId: "course-1" },
      };

      const result = guard.canActivate(contextFor(StudentCourseRoute, request));

      if (status === "APPROVED" || status === "COMPLETED") {
        await expect(result).resolves.toBe(true);
      } else {
        const error: unknown = await result.catch((caught: unknown) => caught);
        expect(error).toBeInstanceOf(ApiException);
        expect(error).toMatchObject({ code: "ENROLLMENT_NOT_ACTIVE" });
        expect((error as ApiException).getStatus()).toBe(403);
      }
      expect(hasActiveEnrollment).toHaveBeenCalledWith("user-1", "course-1");
    });

    test("a missing route parameter is refused without a lookup hit", async () => {
      const { guard, hasActiveEnrollment } = build({ student: sessionFor("student", "STUDENT") });
      hasActiveEnrollment.mockResolvedValue(false);

      await expect(
        guard.canActivate(contextFor(StudentCourseRoute, { headers: { cookie: cookies.student } })),
      ).rejects.toMatchObject({ code: "ENROLLMENT_NOT_ACTIVE" });
      expect(hasActiveEnrollment).toHaveBeenCalledWith("user-1", "");
    });

    test("the enrollment is looked up on every request", async () => {
      const { guard, hasActiveEnrollment } = build(
        { student: sessionFor("student", "STUDENT") },
        "APPROVED",
      );
      const request = (): Request => ({
        headers: { cookie: cookies.student },
        params: { courseId: "course-1" },
      });

      await guard.canActivate(contextFor(StudentCourseRoute, request()));
      await guard.canActivate(contextFor(StudentCourseRoute, request()));

      expect(hasActiveEnrollment).toHaveBeenCalledTimes(2);
    });
  });
});

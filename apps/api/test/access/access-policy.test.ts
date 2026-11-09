import { Reflector } from "@nestjs/core";
import { describe, expect, test } from "vitest";
import { Audience, RequireCourseAccess, Roles } from "../../src/access/access.decorators";
import { resolveAccessPolicy } from "../../src/access/access-policy";
import { Public } from "../../src/auth/public.decorator";

const policyOf = (controller: new () => object) =>
  resolveAccessPolicy(new Reflector(), [
    Reflect.get(controller.prototype, "handler") as () => void,
    controller,
  ]);

class Bare {
  handler(): void {}
}

class Open {
  @Public()
  handler(): void {}
}

class StudentOnly {
  @Audience("student")
  handler(): void {}
}

class StudentCourse {
  @Audience("student")
  @RequireCourseAccess("lessonCourse")
  handler(): void {}
}

class StudentDefaultParam {
  @Audience("student")
  @RequireCourseAccess()
  handler(): void {}
}

class AdminWithRoles {
  @Audience("admin")
  @Roles("ADMIN", "SUPER_ADMIN")
  handler(): void {}
}

class AdminWithoutRoles {
  @Audience("admin")
  handler(): void {}
}

class AdminWithStudentRole {
  @Audience("admin")
  @Roles("STUDENT")
  handler(): void {}
}

class StudentWithAdminRole {
  @Audience("student")
  @Roles("ADMIN")
  handler(): void {}
}

class EmptyRoles {
  @Audience("admin")
  @Roles()
  handler(): void {}
}

class RolesOnly {
  @Roles("ADMIN")
  handler(): void {}
}

class PublicAndAudience {
  @Public()
  @Audience("student")
  handler(): void {}
}

class AdminCourse {
  @Audience("admin")
  @Roles("ADMIN")
  @RequireCourseAccess()
  handler(): void {}
}

@Audience("student")
class ClassStudent {
  handler(): void {}

  @Public()
  open(): void {}
}

@Audience("admin")
@Roles("SUPER_ADMIN")
class ClassAdmin {
  @Roles("ADMIN")
  handler(): void {}
}

describe("resolveAccessPolicy", () => {
  test("a route with no metadata is denied", () => {
    expect(policyOf(Bare)).toMatchObject({ kind: "denied" });
  });

  test("Public is public", () => {
    expect(policyOf(Open)).toEqual({ kind: "public" });
  });

  test("a student route defaults to the STUDENT role", () => {
    expect(policyOf(StudentOnly)).toEqual({
      kind: "protected",
      audience: "student",
      roles: ["STUDENT"],
    });
  });

  test("RequireCourseAccess carries the route parameter name, default courseId", () => {
    expect(policyOf(StudentCourse)).toMatchObject({ courseParam: "lessonCourse" });
    expect(policyOf(StudentDefaultParam)).toMatchObject({ courseParam: "courseId" });
  });

  test("an admin route lists its roles explicitly", () => {
    expect(policyOf(AdminWithRoles)).toEqual({
      kind: "protected",
      audience: "admin",
      roles: ["ADMIN", "SUPER_ADMIN"],
    });
  });

  test.each([
    ["admin audience without Roles", AdminWithoutRoles],
    ["admin audience with the STUDENT role", AdminWithStudentRole],
    ["student audience with an admin role", StudentWithAdminRole],
    ["an empty Roles list", EmptyRoles],
    ["Roles without an audience", RolesOnly],
    ["Public together with Audience on the handler", PublicAndAudience],
    ["course access on an admin route", AdminCourse],
  ])("%s is denied", (_name, controller) => {
    expect(policyOf(controller)).toMatchObject({ kind: "denied" });
  });

  test("class-level metadata applies and a method-level Public overrides it", () => {
    expect(policyOf(ClassStudent)).toMatchObject({ kind: "protected", audience: "student" });
    expect(
      resolveAccessPolicy(new Reflector(), [ClassStudent.prototype.open, ClassStudent]),
    ).toEqual({ kind: "public" });
  });

  test("method-level Roles override class-level Roles", () => {
    expect(policyOf(ClassAdmin)).toMatchObject({ roles: ["ADMIN"] });
  });
});

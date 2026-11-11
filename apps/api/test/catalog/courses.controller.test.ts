import { describe, expect, test } from "vitest";
import { AUDIENCE_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { AUDITED_KEY } from "../../src/audit/audited.decorator";
import { CoursesController } from "../../src/catalog/courses.controller";

describe("CoursesController access", () => {
  test("the whole controller is for the admin audience with an explicit role list", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, CoursesController)).toBe("admin");
    expect(Reflect.getMetadata(ROLES_KEY, CoursesController)).toEqual(["ADMIN", "SUPER_ADMIN"]);
  });

  test.each([
    ["create", "course.create"],
    ["update", "course.update"],
    ["remove", "course.delete"],
    ["publish", "course.publish"],
  ] as const)("%s is audited as %s", (handler, action) => {
    const method = CoursesController.prototype[handler];
    expect(Reflect.getMetadata(AUDITED_KEY, method)).toEqual({ action, entity: "Course" });
  });

  test.each(["list", "get"] as const)("%s is a read and is not audited", (handler) => {
    expect(Reflect.getMetadata(AUDITED_KEY, CoursesController.prototype[handler])).toBeUndefined();
  });
});

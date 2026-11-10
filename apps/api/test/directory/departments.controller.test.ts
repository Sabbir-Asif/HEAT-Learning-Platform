import { describe, expect, test } from "vitest";
import { AUDIENCE_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { AUDITED_KEY } from "../../src/audit/audited.decorator";
import { DepartmentsController } from "../../src/directory/departments.controller";

describe("DepartmentsController access", () => {
  test("the whole controller is for the admin audience with an explicit role list", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, DepartmentsController)).toBe("admin");
    expect(Reflect.getMetadata(ROLES_KEY, DepartmentsController)).toEqual(["ADMIN", "SUPER_ADMIN"]);
  });

  test.each([
    ["create", "department.create"],
    ["update", "department.update"],
    ["remove", "department.delete"],
  ] as const)("%s is audited as %s", (handler, action) => {
    const method = DepartmentsController.prototype[handler];
    expect(Reflect.getMetadata(AUDITED_KEY, method)).toEqual({ action, entity: "Department" });
  });

  test.each(["list", "get"] as const)("%s is a read and is not audited", (handler) => {
    expect(
      Reflect.getMetadata(AUDITED_KEY, DepartmentsController.prototype[handler]),
    ).toBeUndefined();
  });
});

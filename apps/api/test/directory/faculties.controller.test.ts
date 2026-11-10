import { describe, expect, test } from "vitest";
import { AUDIENCE_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { AUDITED_KEY } from "../../src/audit/audited.decorator";
import { FacultiesController } from "../../src/directory/faculties.controller";

describe("FacultiesController access", () => {
  test("the whole controller is for the admin audience with an explicit role list", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, FacultiesController)).toBe("admin");
    expect(Reflect.getMetadata(ROLES_KEY, FacultiesController)).toEqual(["ADMIN", "SUPER_ADMIN"]);
  });

  test.each([
    ["create", "faculty.create"],
    ["update", "faculty.update"],
    ["remove", "faculty.delete"],
    ["archive", "faculty.archive"],
    ["restore", "faculty.restore"],
    ["assign", "faculty.assign"],
    ["unassign", "faculty.unassign"],
  ] as const)("%s is audited as %s", (handler, action) => {
    const method = FacultiesController.prototype[handler];
    expect(Reflect.getMetadata(AUDITED_KEY, method)).toEqual({ action, entity: "Faculty" });
  });

  test.each(["list", "get"] as const)("%s is a read and is not audited", (handler) => {
    expect(
      Reflect.getMetadata(AUDITED_KEY, FacultiesController.prototype[handler]),
    ).toBeUndefined();
  });
});

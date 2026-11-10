import { describe, expect, test } from "vitest";
import { AUDIENCE_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { AUDITED_KEY } from "../../src/audit/audited.decorator";
import { UniversitiesController } from "../../src/directory/universities.controller";

describe("UniversitiesController access", () => {
  test("the whole controller is for the admin audience with an explicit role list", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, UniversitiesController)).toBe("admin");
    expect(Reflect.getMetadata(ROLES_KEY, UniversitiesController)).toEqual([
      "ADMIN",
      "SUPER_ADMIN",
    ]);
  });

  test.each([
    ["create", "university.create"],
    ["update", "university.update"],
    ["remove", "university.delete"],
  ] as const)("%s is audited as %s", (handler, action) => {
    const method = UniversitiesController.prototype[handler];
    expect(Reflect.getMetadata(AUDITED_KEY, method)).toEqual({ action, entity: "University" });
  });

  test.each(["list", "get"] as const)("%s is a read and is not audited", (handler) => {
    expect(
      Reflect.getMetadata(AUDITED_KEY, UniversitiesController.prototype[handler]),
    ).toBeUndefined();
  });
});

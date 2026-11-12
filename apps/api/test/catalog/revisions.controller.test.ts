import { describe, expect, test } from "vitest";
import { AUDIENCE_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { AUDITED_KEY } from "../../src/audit/audited.decorator";
import { RevisionsController } from "../../src/catalog/revisions.controller";

describe("RevisionsController access", () => {
  test("the whole controller is for the admin audience with an explicit role list", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, RevisionsController)).toBe("admin");
    expect(Reflect.getMetadata(ROLES_KEY, RevisionsController)).toEqual(["ADMIN", "SUPER_ADMIN"]);
  });

  test.each([
    ["clone", "course.revision.clone"],
    ["publish", "course.revision.publish"],
  ] as const)("%s is audited as %s", (handler, action) => {
    const method = RevisionsController.prototype[handler];
    expect(Reflect.getMetadata(AUDITED_KEY, method)).toEqual({ action, entity: "CourseRevision" });
  });

  test("list is a read and is not audited", () => {
    expect(Reflect.getMetadata(AUDITED_KEY, RevisionsController.prototype.list)).toBeUndefined();
  });
});

import { describe, expect, test } from "vitest";
import { AUDIENCE_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { AUDITED_KEY } from "../../src/audit/audited.decorator";
import { LessonSectionsController } from "../../src/catalog/lesson-sections.controller";
import { ModulesController } from "../../src/catalog/modules.controller";

describe.each([
  ["ModulesController", ModulesController],
  ["LessonSectionsController", LessonSectionsController],
])("%s access", (_name, controller) => {
  test("the whole controller is for the admin audience with an explicit role list", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, controller)).toBe("admin");
    expect(Reflect.getMetadata(ROLES_KEY, controller)).toEqual(["ADMIN", "SUPER_ADMIN"]);
  });
});

describe("module writes are audited", () => {
  test.each([
    ["create", "module.create", "Module"],
    ["reorder", "module.reorder", "CourseRevision"],
    ["update", "module.update", "Module"],
    ["remove", "module.delete", "Module"],
  ] as const)("%s is audited as %s", (handler, action, entity) => {
    expect(Reflect.getMetadata(AUDITED_KEY, ModulesController.prototype[handler])).toEqual({
      action,
      entity,
    });
  });

  test.each(["list", "get"] as const)("%s is a read and is not audited", (handler) => {
    expect(Reflect.getMetadata(AUDITED_KEY, ModulesController.prototype[handler])).toBeUndefined();
  });
});

describe("lesson section writes are audited", () => {
  test.each([
    ["create", "lesson-section.create", "LessonSection"],
    ["reorder", "lesson-section.reorder", "Module"],
    ["update", "lesson-section.update", "LessonSection"],
    ["remove", "lesson-section.delete", "LessonSection"],
  ] as const)("%s is audited as %s", (handler, action, entity) => {
    expect(Reflect.getMetadata(AUDITED_KEY, LessonSectionsController.prototype[handler])).toEqual({
      action,
      entity,
    });
  });
});

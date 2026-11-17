import { describe, expect, test } from "vitest";
import { AUDIENCE_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { AUDITED_KEY } from "../../src/audit/audited.decorator";
import { IS_PUBLIC } from "../../src/auth/public.decorator";
import {
  AdminFrontPageController,
  PublicFrontPageController,
} from "../../src/catalog/front-page.controller";
import { TagAssignmentsController, TagsController } from "../../src/catalog/tags.controller";

describe.each([TagsController, TagAssignmentsController, AdminFrontPageController])(
  "%o access",
  (controller) => {
    test("is for the admin audience with an explicit role list", () => {
      expect(Reflect.getMetadata(AUDIENCE_KEY, controller)).toBe("admin");
      expect(Reflect.getMetadata(ROLES_KEY, controller)).toEqual(["ADMIN", "SUPER_ADMIN"]);
    });
  },
);

describe("audited writes", () => {
  test.each([
    [TagsController.prototype.create, "tag.create"],
    [TagsController.prototype.update, "tag.update"],
    [TagsController.prototype.remove, "tag.delete"],
    [TagAssignmentsController.prototype.setCourseTags, "course.tags.set"],
    [TagAssignmentsController.prototype.setModuleTags, "module.tags.set"],
    [AdminFrontPageController.prototype.reorderCourses, "front-page.reorder-courses"],
    [AdminFrontPageController.prototype.reorderModules, "front-page.reorder-modules"],
  ])("%o is audited as %s", (method, action) => {
    expect(Reflect.getMetadata(AUDITED_KEY, method)).toMatchObject({ action });
  });
});

describe("PublicFrontPageController", () => {
  test("is the only public route here and has no audience", () => {
    expect(Reflect.getMetadata(IS_PUBLIC, PublicFrontPageController)).toBe(true);
    expect(Reflect.getMetadata(AUDIENCE_KEY, PublicFrontPageController)).toBeUndefined();
  });
});

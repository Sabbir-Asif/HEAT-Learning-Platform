import { describe, expect, test } from "vitest";
import { AUDIENCE_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { AUDITED_KEY } from "../../src/audit/audited.decorator";
import { IS_PUBLIC } from "../../src/auth/public.decorator";
import { PublicResourcesController } from "../../src/resources/public-resources.controller";
import { ResourcesController } from "../../src/resources/resources.controller";

describe("ResourcesController", () => {
  test("is for admins only with an explicit role list", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, ResourcesController)).toBe("admin");
    expect(Reflect.getMetadata(ROLES_KEY, ResourcesController)).toEqual(["ADMIN", "SUPER_ADMIN"]);
  });

  test("audits every write", () => {
    for (const name of ["create", "update", "remove"] as const) {
      expect(Reflect.getMetadata(AUDITED_KEY, ResourcesController.prototype[name])).toBeDefined();
    }
  });
});

describe("PublicResourcesController", () => {
  test("is public with no audience", () => {
    expect(Reflect.getMetadata(IS_PUBLIC, PublicResourcesController)).toBe(true);
    expect(Reflect.getMetadata(AUDIENCE_KEY, PublicResourcesController)).toBeUndefined();
  });
});

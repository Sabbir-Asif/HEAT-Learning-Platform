import { describe, expect, test } from "vitest";
import { AUDIENCE_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { AUDITED_KEY } from "../../src/audit/audited.decorator";
import { IS_PUBLIC } from "../../src/auth/public.decorator";
import {
  AdminContactSettingsController,
  PublicContactSettingsController,
} from "../../src/catalog/contact-settings.controller";

describe("AdminContactSettingsController", () => {
  test("is for the admin audience with an explicit role list", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, AdminContactSettingsController)).toBe("admin");
    expect(Reflect.getMetadata(ROLES_KEY, AdminContactSettingsController)).toEqual([
      "ADMIN",
      "SUPER_ADMIN",
    ]);
  });

  test("audits the update", () => {
    expect(
      Reflect.getMetadata(AUDITED_KEY, AdminContactSettingsController.prototype.update),
    ).toMatchObject({ action: "site-settings.contact" });
  });
});

describe("PublicContactSettingsController", () => {
  test("is public with no audience", () => {
    expect(Reflect.getMetadata(IS_PUBLIC, PublicContactSettingsController)).toBe(true);
    expect(Reflect.getMetadata(AUDIENCE_KEY, PublicContactSettingsController)).toBeUndefined();
  });
});

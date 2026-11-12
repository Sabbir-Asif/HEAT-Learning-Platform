import { describe, expect, test } from "vitest";
import { AUDIENCE_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { AUDITED_KEY } from "../../src/audit/audited.decorator";
import { IS_PUBLIC } from "../../src/auth/public.decorator";
import {
  AdminSiteSettingsController,
  PublicSiteSettingsController,
} from "../../src/catalog/site-settings.controller";

describe("AdminSiteSettingsController", () => {
  test("is for the admin audience with an explicit role list", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, AdminSiteSettingsController)).toBe("admin");
    expect(Reflect.getMetadata(ROLES_KEY, AdminSiteSettingsController)).toEqual([
      "ADMIN",
      "SUPER_ADMIN",
    ]);
  });

  test("audits the update", () => {
    expect(
      Reflect.getMetadata(AUDITED_KEY, AdminSiteSettingsController.prototype.update),
    ).toMatchObject({ action: "site-settings.landing-overview" });
  });
});

describe("PublicSiteSettingsController", () => {
  test("is public with no audience", () => {
    expect(Reflect.getMetadata(IS_PUBLIC, PublicSiteSettingsController)).toBe(true);
    expect(Reflect.getMetadata(AUDIENCE_KEY, PublicSiteSettingsController)).toBeUndefined();
  });
});

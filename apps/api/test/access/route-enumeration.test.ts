import { Controller, Get, Post } from "@nestjs/common";
import { DiscoveryModule, DiscoveryService, MetadataScanner } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { AppModule } from "../../src/app.module";
import { Audience, Roles } from "../../src/access";
import { Public } from "../../src/auth";
import { RATE_LIMIT_PROFILE_KEY } from "../../src/rate-limit/rate-limit.guard";
import { applyEnvironment, authTestEnvironment } from "../support/auth-env";
import {
  enumerateCsrfModes,
  enumerateRouteAccess,
  enumerateRouteRateLimits,
  unguardedRoutes,
} from "../support/enumerate-routes";

const enumerateLimits = async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [DiscoveryModule, AppModule],
  }).compile();
  const limits = enumerateRouteRateLimits(
    moduleRef.get(DiscoveryService),
    new MetadataScanner(),
    RATE_LIMIT_PROFILE_KEY,
  );
  await moduleRef.close();
  return limits;
};

const enumerateModes = async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [DiscoveryModule, AppModule],
  }).compile();
  const modes = enumerateCsrfModes(moduleRef.get(DiscoveryService), new MetadataScanner());
  await moduleRef.close();
  return modes;
};

const enumerate = async (imports: unknown[], controllers: Array<new () => object> = []) => {
  const moduleRef = await Test.createTestingModule({
    imports: [DiscoveryModule, ...(imports as [])],
    controllers,
  }).compile();
  const routes = enumerateRouteAccess(moduleRef.get(DiscoveryService), new MetadataScanner());
  await moduleRef.close();
  return routes;
};

describe("deny-by-default route enumeration", () => {
  let restoreEnvironment: () => void;

  beforeAll(() => {
    restoreEnvironment = applyEnvironment({
      ...authTestEnvironment,
      DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/unused",
      REDIS_URL: "redis://127.0.0.1:1",
    });
  });

  afterAll(() => {
    restoreEnvironment();
  });

  test("every route registered by the real AppModule carries valid access metadata", async () => {
    const routes = await enumerate([AppModule]);

    expect(routes.length).toBeGreaterThan(0);
    expect(unguardedRoutes(routes)).toEqual([]);
  });

  test("the enumeration sees the known routes with their full path", async () => {
    const routes = await enumerate([AppModule]);

    const names = routes.map((entry) => entry.route);
    expect(names).toContain("GET /api/health (HealthController.check)");
    expect(names).toContain("POST /api/auth/sign-in (StudentAuthController.signIn)");
    expect(names).toContain("GET /api/me (MeController.describe)");
    expect(names).toContain(
      "GET /api/directory/universities (DirectoryLookupsController.listUniversities)",
    );
  });

  test("sensitive routes carry the expected rate limit profile", async () => {
    const limits = await enumerateLimits();

    expect(limits).toMatchObject({
      "POST /api/auth/sign-in": "signIn",
      "POST /api/auth/refresh": "sessionRefresh",
      "POST /api/admin/auth/sign-in": "adminSignIn",
      "POST /api/admin/auth/refresh": "sessionRefresh",
      "POST /api/admin/account/change-password": "passwordChange",
      "POST /api/captcha": "captcha",
      "GET /api/directory/universities": "directoryLookup",
      "GET /api/directory/universities/:universityId/faculties": "directoryLookup",
      "GET /api/directory/universities/:universityId/faculties/:facultyId/departments":
        "directoryLookup",
      "POST /api/admin/admins": "adminInvite",
      "POST /api/admin/admins/:id/resend-invitation": "adminInvite",
      "POST /api/admin/auth/invitations/lookup": "verify",
      "POST /api/admin/auth/invitations/accept": "verify",
    });
  });

  test("every public unsafe route carries its exact rate limit profile", async () => {
    const limits = await enumerateLimits();
    const modes = await enumerateModes();

    const publicUnsafe = Object.entries(modes)
      .filter(([, mode]) => mode === "origin-only")
      .map(([route]) => route)
      .sort();
    const profiles = Object.fromEntries(publicUnsafe.map((route) => [route, limits[route]]));
    expect(profiles).toEqual({
      "POST /api/admin/auth/invitations/accept": "verify",
      "POST /api/admin/auth/invitations/lookup": "verify",
      "POST /api/admin/auth/refresh": "sessionRefresh",
      "POST /api/admin/auth/sign-in": "adminSignIn",
      "POST /api/auth/refresh": "sessionRefresh",
      "POST /api/auth/sign-in": "signIn",
      "POST /api/auth/verify-email": "verify",
      "POST /api/auth/verify-email/resend": "resendVerification",
      "POST /api/captcha": "captcha",
      "POST /api/enrollment": "enrollment",
    });
  });

  test("every unsafe route needs the CSRF token unless it is a reviewed public route", async () => {
    const modes = await enumerateModes();

    const originOnly = Object.entries(modes)
      .filter(([, mode]) => mode === "origin-only")
      .map(([route]) => route)
      .sort();
    expect(originOnly).toEqual([
      "POST /api/admin/auth/invitations/accept",
      "POST /api/admin/auth/invitations/lookup",
      "POST /api/admin/auth/refresh",
      "POST /api/admin/auth/sign-in",
      "POST /api/auth/refresh",
      "POST /api/auth/sign-in",
      "POST /api/auth/verify-email",
      "POST /api/auth/verify-email/resend",
      "POST /api/captcha",
      "POST /api/enrollment",
    ]);
    expect(modes).toMatchObject({
      "POST /api/auth/sign-out": "token",
      "POST /api/admin/auth/sign-out": "token",
      "POST /api/admin/account/change-password": "token",
      "POST /api/admin/admins": "token",
      "POST /api/admin/admins/:id/deactivate": "token",
      "POST /api/admin/admins/:id/reactivate": "token",
      "POST /api/admin/admins/:id/resend-invitation": "token",
    });
    expect(Object.keys(modes).some((route) => route.startsWith("GET "))).toBe(false);
  });

  test("a controller method with no access decorator fails the check and is named", async () => {
    @Controller("fixture")
    class FixtureController {
      @Get("covered")
      @Public()
      covered(): void {}

      @Post("forgotten")
      forgotten(): void {}

      @Get("admin-without-roles")
      @Audience("admin")
      adminWithoutRoles(): void {}

      @Get("admin-ok")
      @Audience("admin")
      @Roles("ADMIN")
      adminOk(): void {}
    }

    const failures = unguardedRoutes(await enumerate([], [FixtureController]));

    expect(failures).toHaveLength(2);
    expect(failures[0]).toContain("POST /api/fixture/forgotten (FixtureController.forgotten)");
    expect(failures[1]).toContain(
      "GET /api/fixture/admin-without-roles (FixtureController.adminWithoutRoles)",
    );
    expect(failures.join("\n")).not.toContain("covered");
    expect(failures.join("\n")).not.toContain("admin-ok");
  });
});

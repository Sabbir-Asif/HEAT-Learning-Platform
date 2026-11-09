import { Controller, Get, Post } from "@nestjs/common";
import { DiscoveryModule, DiscoveryService, MetadataScanner } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { AppModule } from "../../src/app.module";
import { Audience, Roles } from "../../src/access";
import { Public } from "../../src/auth";
import { applyEnvironment, authTestEnvironment } from "../support/auth-env";
import { enumerateRouteAccess, unguardedRoutes } from "../support/enumerate-routes";

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

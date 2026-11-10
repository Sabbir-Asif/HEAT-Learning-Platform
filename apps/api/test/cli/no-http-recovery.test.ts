import { DiscoveryModule, DiscoveryService, MetadataScanner } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { AppModule } from "../../src/app.module";
import { RecoverSuperAdminService } from "../../src/cli/recover-super-admin.service";
import { applyEnvironment, authTestEnvironment } from "../support/auth-env";
import { enumerateRouteAccess } from "../support/enumerate-routes";

describe("break-glass recovery is not reachable over HTTP", () => {
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

  test("no route mentions recovery and the service is not part of the HTTP application", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DiscoveryModule, AppModule],
    }).compile();
    const routes = enumerateRouteAccess(moduleRef.get(DiscoveryService), new MetadataScanner());

    expect(routes.length).toBeGreaterThan(0);
    expect(routes.filter((entry) => /recover|break-?glass/i.test(entry.route))).toEqual([]);
    expect(() => moduleRef.get(RecoverSuperAdminService, { strict: false })).toThrow();
    await moduleRef.close();
  });
});

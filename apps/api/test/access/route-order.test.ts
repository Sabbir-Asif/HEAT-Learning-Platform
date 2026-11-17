import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { AppModule } from "../../src/app.module";
import { applyEnvironment, authTestEnvironment } from "../support/auth-env";

interface RegisteredRoute {
  method: string;
  path: string;
}

interface RouterLayer {
  route?: { path: string; methods: Record<string, boolean> };
}

const registeredRoutes = (app: NestExpressApplication): RegisteredRoute[] => {
  const instance = app.getHttpAdapter().getInstance() as {
    router: { stack: RouterLayer[] };
  };
  const routes: RegisteredRoute[] = [];
  for (const layer of instance.router.stack) {
    if (layer.route === undefined) continue;
    for (const method of Object.keys(layer.route.methods)) {
      routes.push({ method: method.toUpperCase(), path: layer.route.path });
    }
  }
  return routes;
};

const isParameter = (segment: string | undefined): boolean =>
  segment !== undefined && segment.startsWith(":");

const shadowedRoutes = (routes: RegisteredRoute[]): string[] => {
  const shadowed: string[] = [];
  routes.forEach((later, laterIndex) => {
    const laterSegments = later.path.split("/");
    routes.slice(0, laterIndex).forEach((earlier) => {
      if (earlier.method !== later.method) return;
      const earlierSegments = earlier.path.split("/");
      if (earlierSegments.length !== laterSegments.length) return;
      const last = laterSegments.length - 1;
      const samePrefix = laterSegments.slice(0, last).every((s, i) => s === earlierSegments[i]);
      if (samePrefix && isParameter(earlierSegments[last]) && !isParameter(laterSegments[last])) {
        shadowed.push(`${later.method} ${later.path} is registered after ${earlier.path}`);
      }
    });
  });
  return shadowed;
};

describe("route registration order", () => {
  let restoreEnvironment: () => void;
  let routes: RegisteredRoute[];

  beforeAll(async () => {
    restoreEnvironment = applyEnvironment({
      ...authTestEnvironment,
      DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/unused",
      REDIS_URL: "redis://127.0.0.1:1",
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication<NestExpressApplication>();
    app.setGlobalPrefix("api");
    await app.init();
    routes = registeredRoutes(app);
    await app.close();
  });

  afterAll(() => {
    restoreEnvironment();
  });

  test("the real app registers routes", () => {
    expect(routes.length).toBeGreaterThan(50);
  });

  test("no static route is registered after a sibling parameter route", () => {
    expect(shadowedRoutes(routes)).toEqual([]);
  });

  test("the student export is registered before the student detail", () => {
    const paths = routes.filter((route) => route.method === "GET").map((route) => route.path);
    const exportIndex = paths.indexOf("/api/admin/students/export");
    const detailIndex = paths.indexOf("/api/admin/students/:id");
    expect(exportIndex).toBeGreaterThanOrEqual(0);
    expect(detailIndex).toBeGreaterThanOrEqual(0);
    expect(exportIndex).toBeLessThan(detailIndex);
  });
});

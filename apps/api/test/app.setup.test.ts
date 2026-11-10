import { Controller, ForbiddenException, Get, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { expect, test } from "vitest";
import { configureApp } from "../src/app.setup";
import { createHttpAdapter } from "../src/http/http-adapter";

interface Layer {
  route?: { path: string };
}

test("configureApp registers no route outside Nest controllers", async () => {
  @Module({})
  class EmptyModule {}

  const moduleRef = await Test.createTestingModule({ imports: [EmptyModule] }).compile();
  const adapter = createHttpAdapter();
  const app = moduleRef.createNestApplication(adapter);
  configureApp(app);
  await app.init();

  const router = (adapter.getInstance() as { router: { stack: Layer[] } }).router;
  const routes = router.stack.filter((layer) => layer.route !== undefined);
  await app.close();

  expect(routes.map((layer) => layer.route?.path)).toEqual([]);
});

test("configureApp sets the security headers on success, error and unknown-route responses", async () => {
  @Controller("probe")
  class ProbeController {
    @Get("ok")
    ok(): { ok: boolean } {
      return { ok: true };
    }

    @Get("denied")
    denied(): never {
      throw new ForbiddenException();
    }
  }

  @Module({ controllers: [ProbeController] })
  class ProbeModule {}

  const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
  const app = moduleRef.createNestApplication(createHttpAdapter());
  configureApp(app);
  await app.listen(0);
  const base = await app.getUrl();

  const responses = await Promise.all(
    ["/api/probe/ok", "/api/probe/denied", "/api/missing"].map((path) => fetch(`${base}${path}`)),
  );
  await app.close();

  expect(responses.map((response) => response.status)).toEqual([200, 403, 404]);
  for (const response of responses) {
    expect(response.headers.get("strict-transport-security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("content-security-policy")).toBe(
      "default-src 'none';base-uri 'none';form-action 'none';frame-ancestors 'none'",
    );
    expect(response.headers.get("x-powered-by")).toBeNull();
  }
});

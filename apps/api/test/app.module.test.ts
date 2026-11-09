import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, expect, test } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { applyEnvironment, authTestEnvironment } from "./support/auth-env";

let app: INestApplication;
let baseUrl: string;
let restoreEnvironment: () => void;

beforeAll(async () => {
  restoreEnvironment = applyEnvironment({
    ...authTestEnvironment,
    DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/unused",
    REDIS_URL: "redis://127.0.0.1:1",
  });
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.listen(0);
  baseUrl = await app.getUrl();
});

afterAll(async () => {
  await app.close();
  restoreEnvironment();
});

test("serves GET /api/health over HTTP", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});

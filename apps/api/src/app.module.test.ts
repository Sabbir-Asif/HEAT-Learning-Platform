import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, expect, test } from "vitest";
import { AppModule } from "./app.module";
import { configureApp } from "./app.setup";

let app: INestApplication;
let baseUrl: string;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.listen(0);
  baseUrl = await app.getUrl();
});

afterAll(() => app.close());

test("serves GET /api/health over HTTP", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});

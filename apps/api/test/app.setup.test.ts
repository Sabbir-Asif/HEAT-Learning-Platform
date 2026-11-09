import { Module } from "@nestjs/common";
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

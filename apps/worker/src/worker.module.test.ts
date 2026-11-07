import { expect, test } from "vitest";
import { Module } from "@nestjs/common";
import { WorkerModule } from "./worker.module";

test("worker module is a Nest module with no HTTP controllers", () => {
  expect(Reflect.getMetadata("controllers", WorkerModule)).toBeUndefined();
  expect(Reflect.getMetadata("imports", WorkerModule)).toHaveLength(1);
  expect(Module).toBeTypeOf("function");
});

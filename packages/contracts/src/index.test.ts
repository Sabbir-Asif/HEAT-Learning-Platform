import { expect, test } from "vitest";
import { healthResponseSchema } from "./index";

test("health schema accepts an ok response", () => {
  expect(healthResponseSchema.parse({ status: "ok" })).toEqual({ status: "ok" });
});

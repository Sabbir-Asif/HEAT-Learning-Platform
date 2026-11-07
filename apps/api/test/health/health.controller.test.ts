import { expect, test } from "vitest";
import { healthResponseSchema } from "@heat/contracts";
import { HealthController } from "../../src/health/health.controller";

test("reports ok in the shape defined by @heat/contracts", () => {
  const body = new HealthController().check();
  expect(healthResponseSchema.parse(body)).toEqual({ status: "ok" });
});

import { expect, test } from "vitest";
import { systemClock } from "../../src/core";

test("the system clock returns the current time", () => {
  const before = Date.now();
  const now = systemClock.now().getTime();
  expect(now).toBeGreaterThanOrEqual(before);
  expect(now).toBeLessThanOrEqual(Date.now());
});

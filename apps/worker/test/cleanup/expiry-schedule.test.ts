import { expect, test } from "vitest";
import { nextExpiryRunAt } from "../../src/cleanup/expiry-schedule";

test("runs at 02:00 Asia/Dhaka, which is 20:00 UTC the day before", () => {
  const next = nextExpiryRunAt(new Date("2026-11-12T10:00:00.000Z"));
  expect(next.toISOString()).toBe("2026-11-12T20:00:00.000Z");
});

test("rolls to the next day once today's run time has passed", () => {
  const next = nextExpiryRunAt(new Date("2026-11-12T20:00:00.000Z"));
  expect(next.toISOString()).toBe("2026-11-13T20:00:00.000Z");
});

test("rolls over month boundaries", () => {
  const next = nextExpiryRunAt(new Date("2026-11-30T21:00:00.000Z"));
  expect(next.toISOString()).toBe("2026-12-01T20:00:00.000Z");
});

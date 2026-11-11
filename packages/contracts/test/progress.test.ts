import { describe, expect, test } from "vitest";
import {
  progressBatchSchema,
  progressMaxIntervalsPerBatch,
  progressResponseSchema,
  watchedIntervalSchema,
} from "../src";

const sessionId = "0198f1a0-0000-7000-8000-0000000000b1";

const batch = (overrides: object = {}) => ({
  sessionId,
  sequence: 1,
  positionSeconds: 12.5,
  intervals: [{ start: 0, end: 12.5 }],
  ...overrides,
});

describe("progress contracts", () => {
  test("accepts a heartbeat with intervals and an optional csrf token", () => {
    expect(progressBatchSchema.safeParse(batch()).success).toBe(true);
    expect(progressBatchSchema.safeParse(batch({ csrfToken: "token" })).success).toBe(true);
    expect(progressBatchSchema.safeParse(batch({ intervals: [] })).success).toBe(true);
  });

  test("rejects an interval that ends before it starts or is empty", () => {
    expect(watchedIntervalSchema.safeParse({ start: 5, end: 5 }).success).toBe(false);
    expect(watchedIntervalSchema.safeParse({ start: 6, end: 5 }).success).toBe(false);
  });

  test("rejects negative, oversized and non-finite values", () => {
    expect(watchedIntervalSchema.safeParse({ start: -1, end: 5 }).success).toBe(false);
    expect(watchedIntervalSchema.safeParse({ start: 0, end: 90000 }).success).toBe(false);
    expect(watchedIntervalSchema.safeParse({ start: 0, end: Infinity }).success).toBe(false);
    expect(progressBatchSchema.safeParse(batch({ positionSeconds: -2 })).success).toBe(false);
  });

  test("bounds the sequence number and the batch size", () => {
    expect(progressBatchSchema.safeParse(batch({ sequence: 0 })).success).toBe(false);
    expect(progressBatchSchema.safeParse(batch({ sequence: 1.5 })).success).toBe(false);
    expect(progressBatchSchema.safeParse(batch({ sequence: 2147483648 })).success).toBe(false);
    const tooMany = Array.from({ length: progressMaxIntervalsPerBatch + 1 }, (_, index) => ({
      start: index,
      end: index + 0.5,
    }));
    expect(progressBatchSchema.safeParse(batch({ intervals: tooMany })).success).toBe(false);
  });

  test("rejects a session id that is not a uuid", () => {
    expect(progressBatchSchema.safeParse(batch({ sessionId: "nope" })).success).toBe(false);
  });

  test("the response carries percent, resume position and completion", () => {
    expect(
      progressResponseSchema.safeParse({
        coveragePercent: 80,
        resumePositionSeconds: 30,
        completed: true,
      }).success,
    ).toBe(true);
    expect(
      progressResponseSchema.safeParse({
        coveragePercent: 101,
        resumePositionSeconds: 0,
        completed: false,
      }).success,
    ).toBe(false);
  });
});

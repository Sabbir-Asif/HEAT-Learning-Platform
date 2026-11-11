import { describe, expect, test } from "vitest";
import { isFinalAttempt, transcodeFailure } from "../../src/transcode/transcode-outcome";

describe("transcodeFailure", () => {
  test("a retry outcome asks the queue to try again", () => {
    expect(transcodeFailure({ status: "retry", reason: "ENCODE_FAILED" })).toEqual({
      reason: "ENCODE_FAILED",
      retry: true,
    });
  });

  test("a failed outcome is final so the queue does not retry it", () => {
    expect(transcodeFailure({ status: "failed", reason: "TIMED_OUT" })).toEqual({
      reason: "TIMED_OUT",
      retry: false,
    });
  });

  test("ready and skipped complete the queue job", () => {
    expect(transcodeFailure({ status: "ready" })).toBeNull();
    expect(transcodeFailure({ status: "skipped" })).toBeNull();
  });
});

describe("isFinalAttempt", () => {
  test("is true on the last configured attempt only", () => {
    expect(isFinalAttempt(0, 2)).toBe(false);
    expect(isFinalAttempt(1, 2)).toBe(true);
  });

  test("treats a job without an attempt limit as a single attempt", () => {
    expect(isFinalAttempt(0, undefined)).toBe(true);
  });
});

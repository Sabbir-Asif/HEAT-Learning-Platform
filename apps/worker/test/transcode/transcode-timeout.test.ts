import { describe, expect, test } from "vitest";
import { transcodeTimeoutMs } from "../../src/transcode/transcode-timeout";

const policy = { factor: 8, minSeconds: 600, maxSeconds: 14400 };

describe("transcodeTimeoutMs", () => {
  test("is a multiple of the source duration", () => {
    expect(transcodeTimeoutMs(1000, policy)).toBe(8000 * 1000);
  });

  test("never drops below the minimum for a short source", () => {
    expect(transcodeTimeoutMs(10, policy)).toBe(600 * 1000);
  });

  test("is capped for a very long source", () => {
    expect(transcodeTimeoutMs(7200, policy)).toBe(14400 * 1000);
  });
});

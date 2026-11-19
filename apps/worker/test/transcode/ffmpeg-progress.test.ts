import { describe, expect, test } from "vitest";
import { overallPercent, parseProgressSeconds } from "../../src/transcode/ffmpeg-progress";

describe("parseProgressSeconds", () => {
  test("reads the encoded time and ignores every other line", () => {
    expect(parseProgressSeconds("out_time_us=1500000")).toBe(1.5);
    expect(parseProgressSeconds("out_time_ms=3000000")).toBe(3);
    expect(parseProgressSeconds("out_time_us=N/A")).toBeNull();
    expect(parseProgressSeconds("progress=end")).toBeNull();
  });
});

describe("overallPercent", () => {
  test("spreads the renditions evenly and the encoded time within the current one", () => {
    expect(overallPercent(0, 4, 0, 60)).toBe(0);
    expect(overallPercent(0, 4, 30, 60)).toBe(12);
    expect(overallPercent(2, 4, 30, 60)).toBe(62);
  });

  test("never reaches 100 before the job is marked ready and ignores overshoot", () => {
    expect(overallPercent(3, 4, 120, 60)).toBe(99);
    expect(overallPercent(0, 1, 10, 0)).toBe(0);
  });
});

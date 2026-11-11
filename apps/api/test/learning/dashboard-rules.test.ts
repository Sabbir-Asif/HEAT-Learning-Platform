import { describe, expect, test } from "vitest";
import { resumePointOf } from "../../src/learning/dashboard-rules";

const at = (minute: number) => new Date(Date.UTC(2026, 10, 12, 10, minute));

describe("resumePointOf", () => {
  test("is empty when nothing was watched", () => {
    expect(resumePointOf([])).toEqual({ videoId: null, resumePositionSeconds: 0 });
  });

  test("takes the most recently updated unfinished video", () => {
    expect(
      resumePointOf([
        { videoId: "a", resumePositionSeconds: 30, completedAt: null, updatedAt: at(1) },
        { videoId: "b", resumePositionSeconds: 75, completedAt: null, updatedAt: at(5) },
      ]),
    ).toEqual({ videoId: "b", resumePositionSeconds: 75 });
  });

  test("ignores finished videos and videos with no position", () => {
    expect(
      resumePointOf([
        { videoId: "a", resumePositionSeconds: 30, completedAt: at(9), updatedAt: at(9) },
        { videoId: "b", resumePositionSeconds: 0, completedAt: null, updatedAt: at(8) },
        { videoId: "c", resumePositionSeconds: 12, completedAt: null, updatedAt: at(2) },
      ]),
    ).toEqual({ videoId: "c", resumePositionSeconds: 12 });
  });
});

import { describe, expect, test } from "vitest";
import {
  effectiveModuleStates,
  nextModuleIndex,
  overallProgressPercent,
  quizStateOf,
  quizUnlocked,
  requiredVideoCompletion,
  requiredVideosWatched,
  isVideoWatched,
  videoStatusOf,
} from "../../src/learning/learning-rules";

const now = new Date("2026-11-12T10:00:00.000Z");

const video = (overrides: Partial<Parameters<typeof videoStatusOf>[0]> = {}) => ({
  assetReady: true,
  coverage: 0,
  resumePositionSeconds: 0,
  completedAt: null,
  ...overrides,
});

describe("effectiveModuleStates", () => {
  test("an approved student who has not started sees module 1 unlocked and the rest locked", () => {
    expect(effectiveModuleStates("APPROVED", ["UNLOCKED", "LOCKED", "LOCKED"])).toEqual([
      "UNLOCKED",
      "LOCKED",
      "LOCKED",
    ]);
  });

  test("a missing progress row is locked, except for the first module", () => {
    expect(effectiveModuleStates("APPROVED", [null, null])).toEqual(["UNLOCKED", "LOCKED"]);
  });

  test("stored states pass through when the previous module is completed", () => {
    expect(effectiveModuleStates("APPROVED", ["COMPLETED", "IN_PROGRESS", "LOCKED"])).toEqual([
      "COMPLETED",
      "IN_PROGRESS",
      "LOCKED",
    ]);
  });

  test("a module is clamped to locked while the previous one is not completed", () => {
    expect(effectiveModuleStates("APPROVED", ["IN_PROGRESS", "UNLOCKED", "COMPLETED"])).toEqual([
      "IN_PROGRESS",
      "LOCKED",
      "LOCKED",
    ]);
  });

  test("a completed enrollment shows every module completed", () => {
    expect(effectiveModuleStates("COMPLETED", ["COMPLETED", null, "LOCKED"])).toEqual([
      "COMPLETED",
      "COMPLETED",
      "COMPLETED",
    ]);
  });

  test("an empty course has no states", () => {
    expect(effectiveModuleStates("APPROVED", [])).toEqual([]);
  });
});

describe("nextModuleIndex and overallProgressPercent", () => {
  test("the next module is the first one that is not locked or completed", () => {
    expect(nextModuleIndex(["COMPLETED", "IN_PROGRESS", "LOCKED"])).toBe(1);
    expect(nextModuleIndex(["COMPLETED", "QUIZ_READY", "LOCKED"])).toBe(1);
    expect(nextModuleIndex(["UNLOCKED", "LOCKED"])).toBe(0);
  });

  test("there is no next module when everything is completed or locked", () => {
    expect(nextModuleIndex(["COMPLETED", "COMPLETED"])).toBeNull();
    expect(nextModuleIndex(["LOCKED"])).toBeNull();
    expect(nextModuleIndex([])).toBeNull();
  });

  test("overall progress is the rounded share of completed modules", () => {
    expect(overallProgressPercent(["COMPLETED", "UNLOCKED", "LOCKED"])).toBe(33);
    expect(overallProgressPercent(["COMPLETED", "COMPLETED"])).toBe(100);
    expect(overallProgressPercent(["UNLOCKED"])).toBe(0);
    expect(overallProgressPercent([])).toBe(0);
  });
});

describe("videoStatusOf", () => {
  test("a video without a ready asset is unavailable", () => {
    expect(videoStatusOf(video({ assetReady: false, coverage: 1 }))).toBe("UNAVAILABLE");
  });

  test("an untouched video is not started", () => {
    expect(videoStatusOf(video())).toBe("NOT_STARTED");
  });

  test("some coverage or a resume position means in progress", () => {
    expect(videoStatusOf(video({ coverage: 0.3 }))).toBe("IN_PROGRESS");
    expect(videoStatusOf(video({ resumePositionSeconds: 12 }))).toBe("IN_PROGRESS");
  });

  test("80 percent coverage or a completion time means completed", () => {
    expect(videoStatusOf(video({ coverage: 0.8 }))).toBe("COMPLETED");
    expect(videoStatusOf(video({ coverage: 0.79 }))).toBe("IN_PROGRESS");
    expect(videoStatusOf(video({ completedAt: now }))).toBe("COMPLETED");
  });
});

describe("requiredVideoCompletion", () => {
  test("counts only required videos", () => {
    expect(
      requiredVideoCompletion([
        { required: true, status: "COMPLETED" },
        { required: true, status: "IN_PROGRESS" },
        { required: false, status: "COMPLETED" },
      ]),
    ).toEqual({ completed: 1, total: 2 });
  });

  test("a module with no required videos has zero of zero", () => {
    expect(requiredVideoCompletion([{ required: false, status: "NOT_STARTED" }])).toEqual({
      completed: 0,
      total: 0,
    });
  });
});

describe("quizStateOf", () => {
  const facts = (overrides: Partial<Parameters<typeof quizStateOf>[1]> = {}) => ({
    attemptLimit: 3,
    waitMinutes: 10,
    extraAttempts: 0,
    attempts: [],
    ...overrides,
  });

  test("the quiz is unavailable until the module is quiz ready", () => {
    for (const state of ["LOCKED", "UNLOCKED", "IN_PROGRESS"] as const) {
      expect(quizStateOf(state, facts(), now).availability).toBe("UNAVAILABLE");
    }
  });

  test("a quiz ready module with attempts left is available", () => {
    expect(quizStateOf("QUIZ_READY", facts(), now)).toEqual({
      availability: "AVAILABLE",
      attemptsUsed: 0,
      attemptsAllowed: 3,
      nextAttemptAt: null,
    });
  });

  test("a failed attempt inside the wait window makes the quiz wait", () => {
    const submittedAt = new Date("2026-11-12T09:55:00.000Z");
    const state = quizStateOf(
      "QUIZ_READY",
      facts({ attempts: [{ passed: false, submittedAt }] }),
      now,
    );
    expect(state.availability).toBe("WAITING");
    expect(state.attemptsUsed).toBe(1);
    expect(state.nextAttemptAt).toBe("2026-11-12T10:05:00.000Z");
  });

  test("after the wait window the quiz is available again", () => {
    const submittedAt = new Date("2026-11-12T09:40:00.000Z");
    const state = quizStateOf(
      "QUIZ_READY",
      facts({ attempts: [{ passed: false, submittedAt }] }),
      now,
    );
    expect(state.availability).toBe("AVAILABLE");
    expect(state.nextAttemptAt).toBeNull();
  });

  test("used attempts equal to the allowance exhaust the quiz", () => {
    const attempts = [1, 2, 3].map((hour) => ({
      passed: false,
      submittedAt: new Date(`2026-11-12T0${hour}:00:00.000Z`),
    }));
    const state = quizStateOf("QUIZ_READY", facts({ attempts }), now);
    expect(state.availability).toBe("EXHAUSTED");
    expect(state.attemptsUsed).toBe(3);
    expect(state.nextAttemptAt).toBeNull();
  });

  test("granted extra attempts raise the allowance", () => {
    const attempts = [1, 2, 3].map((hour) => ({
      passed: false,
      submittedAt: new Date(`2026-11-12T0${hour}:00:00.000Z`),
    }));
    const state = quizStateOf("QUIZ_READY", facts({ attempts, extraAttempts: 2 }), now);
    expect(state.availability).toBe("AVAILABLE");
    expect(state.attemptsAllowed).toBe(5);
  });

  test("a null attempt limit is unlimited", () => {
    const attempts = [1, 2, 3, 4].map((hour) => ({
      passed: false,
      submittedAt: new Date(`2026-11-12T0${hour}:00:00.000Z`),
    }));
    const state = quizStateOf("QUIZ_READY", facts({ attemptLimit: null, attempts }), now);
    expect(state.availability).toBe("AVAILABLE");
    expect(state.attemptsAllowed).toBeNull();
  });

  test("a passed attempt or a completed module reports passed", () => {
    const submittedAt = new Date("2026-11-12T08:00:00.000Z");
    expect(
      quizStateOf("QUIZ_READY", facts({ attempts: [{ passed: true, submittedAt }] }), now)
        .availability,
    ).toBe("PASSED");
    expect(quizStateOf("COMPLETED", facts(), now).availability).toBe("PASSED");
  });
});

const rv = (required: boolean, coverage: number, completedAt: Date | null = null) => ({
  required,
  coverage,
  completedAt,
});

describe("requiredVideosWatched", () => {
  test("holds when there are no videos or no required videos", () => {
    expect(requiredVideosWatched([])).toBe(true);
    expect(requiredVideosWatched([rv(false, 0)])).toBe(true);
  });

  test("a single required video needs 80 percent coverage", () => {
    expect(requiredVideosWatched([rv(true, 0.79)])).toBe(false);
    expect(requiredVideosWatched([rv(true, 0.8)])).toBe(true);
    expect(requiredVideosWatched([rv(true, 1)])).toBe(true);
  });

  test("a recorded completion counts even when coverage is lower", () => {
    expect(isVideoWatched({ coverage: 0.1, completedAt: now })).toBe(true);
    expect(requiredVideosWatched([rv(true, 0.1, now)])).toBe(true);
  });

  test("every required video must pass: 100 percent and 50 percent is refused", () => {
    expect(requiredVideosWatched([rv(true, 1), rv(true, 0.5)])).toBe(false);
    expect(requiredVideosWatched([rv(true, 1), rv(true, 0.8), rv(true, 0.95)])).toBe(true);
  });

  test("optional videos never block", () => {
    expect(requiredVideosWatched([rv(true, 0.9), rv(false, 0)])).toBe(true);
    expect(requiredVideosWatched([rv(true, 0.5), rv(false, 1)])).toBe(false);
  });
});

describe("effectiveModuleStates with watch results", () => {
  test("an unlocked or in progress module whose requirement is met is quiz ready", () => {
    expect(effectiveModuleStates("APPROVED", ["IN_PROGRESS"], [true])).toEqual(["QUIZ_READY"]);
    expect(effectiveModuleStates("APPROVED", [null], [true])).toEqual(["QUIZ_READY"]);
    expect(effectiveModuleStates("APPROVED", ["IN_PROGRESS"], [false])).toEqual(["IN_PROGRESS"]);
  });

  test("a locked or completed module is not changed by watch results", () => {
    expect(
      effectiveModuleStates("APPROVED", ["IN_PROGRESS", "LOCKED", "LOCKED"], [true, true, true]),
    ).toEqual(["QUIZ_READY", "LOCKED", "LOCKED"]);
    expect(effectiveModuleStates("APPROVED", ["COMPLETED"], [true])).toEqual(["COMPLETED"]);
  });
});

describe("quizUnlocked", () => {
  test("only quiz ready and completed modules unlock the quiz", () => {
    expect(quizUnlocked("QUIZ_READY")).toBe(true);
    expect(quizUnlocked("COMPLETED")).toBe(true);
    expect(quizUnlocked("LOCKED")).toBe(false);
    expect(quizUnlocked("UNLOCKED")).toBe(false);
    expect(quizUnlocked("IN_PROGRESS")).toBe(false);
  });
});

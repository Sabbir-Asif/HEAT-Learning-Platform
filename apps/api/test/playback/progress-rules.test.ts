import { maxPlaybackRate } from "@heat/contracts";
import { describe, expect, test } from "vitest";
import {
  coverageFraction,
  coveredSeconds,
  decideSequence,
  mergeWithinBudget,
  normaliseIntervals,
  reachesCompletion,
  remainingBudgetSeconds,
  resumePositionOf,
} from "../../src/progress/progress-rules";

const start = new Date("2026-11-11T10:00:00.000Z");
const after = (seconds: number): Date => new Date(start.getTime() + seconds * 1000);

describe("normaliseIntervals", () => {
  test("clamps to the video, drops empty ranges and sorts", () => {
    expect(
      normaliseIntervals(
        [
          { start: 50, end: 200 },
          { start: -5, end: 10 },
          { start: 120, end: 130 },
        ],
        100,
      ),
    ).toEqual([
      { start: 0, end: 10 },
      { start: 50, end: 100 },
    ]);
  });

  test("merges overlapping, touching and duplicate ranges", () => {
    expect(
      normaliseIntervals(
        [
          { start: 0, end: 10 },
          { start: 5, end: 15 },
          { start: 15, end: 20 },
          { start: 0, end: 10 },
          { start: 30, end: 40 },
        ],
        100,
      ),
    ).toEqual([
      { start: 0, end: 20 },
      { start: 30, end: 40 },
    ]);
  });

  test("counts each second once in the covered total", () => {
    const merged = normaliseIntervals(
      [
        { start: 0, end: 10 },
        { start: 5, end: 15 },
        { start: 5, end: 15 },
      ],
      100,
    );
    expect(coveredSeconds(merged)).toBe(15);
    expect(coverageFraction(merged, 100)).toBe(0.15);
  });

  test("rounds to milliseconds so fractions do not drift", () => {
    const merged = normaliseIntervals(
      [
        { start: 0, end: 0.1 },
        { start: 0.1, end: 0.3 },
      ],
      10,
    );
    expect(merged).toEqual([{ start: 0, end: 0.3 }]);
  });
});

describe("coverageFraction", () => {
  test("is zero for an empty video and capped at one", () => {
    expect(coverageFraction([{ start: 0, end: 10 }], 0)).toBe(0);
    expect(coverageFraction([{ start: 0, end: 10 }], 5)).toBe(1);
  });
});

describe("remainingBudgetSeconds", () => {
  test("is elapsed wall-clock time times the top speed minus what was accepted", () => {
    expect(
      remainingBudgetSeconds({
        startedAt: start,
        now: after(10),
        maxRate: maxPlaybackRate,
        acceptedSeconds: 0,
      }),
    ).toBe(15);
    expect(
      remainingBudgetSeconds({
        startedAt: start,
        now: after(10),
        maxRate: maxPlaybackRate,
        acceptedSeconds: 6,
      }),
    ).toBe(9);
  });

  test("never goes negative, also when the clock is behind the start", () => {
    expect(
      remainingBudgetSeconds({
        startedAt: start,
        now: after(2),
        maxRate: 1.5,
        acceptedSeconds: 50,
      }),
    ).toBe(0);
    expect(
      remainingBudgetSeconds({
        startedAt: start,
        now: after(-5),
        maxRate: 1.5,
        acceptedSeconds: 0,
      }),
    ).toBe(0);
  });
});

describe("mergeWithinBudget", () => {
  test("a script posting the whole video 10 seconds in gets at most 10 s x top speed", () => {
    const budget = remainingBudgetSeconds({
      startedAt: start,
      now: after(10),
      maxRate: maxPlaybackRate,
      acceptedSeconds: 0,
    });
    const result = mergeWithinBudget({
      stored: [],
      incoming: [{ start: 0, end: 600 }],
      durationSeconds: 600,
      budgetSeconds: budget,
    });
    expect(result.acceptedSeconds).toBe(15);
    expect(result.merged).toEqual([{ start: 0, end: 15 }]);
    expect(result.coverage).toBe(0.025);
  });

  test("trims earliest first and keeps later pieces out when the budget runs short", () => {
    const result = mergeWithinBudget({
      stored: [],
      incoming: [
        { start: 100, end: 110 },
        { start: 0, end: 10 },
        { start: 50, end: 60 },
      ],
      durationSeconds: 200,
      budgetSeconds: 15,
    });
    expect(result.merged).toEqual([
      { start: 0, end: 10 },
      { start: 50, end: 55 },
    ]);
    expect(result.acceptedSeconds).toBe(15);
  });

  test("only newly covered seconds consume the budget", () => {
    const result = mergeWithinBudget({
      stored: [{ start: 0, end: 10 }],
      incoming: [
        { start: 5, end: 12 },
        { start: 0, end: 10 },
      ],
      durationSeconds: 100,
      budgetSeconds: 100,
    });
    expect(result.acceptedSeconds).toBe(2);
    expect(result.merged).toEqual([{ start: 0, end: 12 }]);
  });

  test("a duplicate batch accepts nothing and changes nothing", () => {
    const first = mergeWithinBudget({
      stored: [],
      incoming: [{ start: 0, end: 20 }],
      durationSeconds: 100,
      budgetSeconds: 100,
    });
    const second = mergeWithinBudget({
      stored: first.merged,
      incoming: [{ start: 0, end: 20 }],
      durationSeconds: 100,
      budgetSeconds: 80,
    });
    expect(second.acceptedSeconds).toBe(0);
    expect(second.merged).toEqual(first.merged);
    expect(second.coverage).toBe(first.coverage);
  });

  test("fills the gaps around stored coverage earliest first within the budget", () => {
    const result = mergeWithinBudget({
      stored: [
        { start: 10, end: 20 },
        { start: 40, end: 50 },
      ],
      incoming: [{ start: 0, end: 60 }],
      durationSeconds: 100,
      budgetSeconds: 25,
    });
    expect(result.acceptedSeconds).toBe(25);
    expect(result.merged).toEqual([
      { start: 0, end: 35 },
      { start: 40, end: 50 },
    ]);
  });

  test("skipping ahead to the end does not count the skipped part", () => {
    const result = mergeWithinBudget({
      stored: [{ start: 0, end: 30 }],
      incoming: [{ start: 270, end: 300 }],
      durationSeconds: 300,
      budgetSeconds: 1000,
    });
    expect(result.acceptedSeconds).toBe(30);
    expect(result.coverage).toBe(0.2);
    expect(result.merged).toEqual([
      { start: 0, end: 30 },
      { start: 270, end: 300 },
    ]);
  });

  test("a zero budget accepts nothing", () => {
    const result = mergeWithinBudget({
      stored: [],
      incoming: [{ start: 0, end: 10 }],
      durationSeconds: 100,
      budgetSeconds: 0,
    });
    expect(result.merged).toEqual([]);
    expect(result.coverage).toBe(0);
  });

  test("late offline batches are accepted within the same budget", () => {
    const first = mergeWithinBudget({
      stored: [],
      incoming: [{ start: 0, end: 30 }],
      durationSeconds: 600,
      budgetSeconds: remainingBudgetSeconds({
        startedAt: start,
        now: after(30),
        maxRate: maxPlaybackRate,
        acceptedSeconds: 0,
      }),
    });
    const late = mergeWithinBudget({
      stored: first.merged,
      incoming: [{ start: 30, end: 150 }],
      durationSeconds: 600,
      budgetSeconds: remainingBudgetSeconds({
        startedAt: start,
        now: after(150),
        maxRate: maxPlaybackRate,
        acceptedSeconds: first.acceptedSeconds,
      }),
    });
    expect(first.acceptedSeconds).toBe(30);
    expect(late.acceptedSeconds).toBe(120);
    expect(late.coverage).toBe(0.25);
  });
});

describe("completion", () => {
  test("is reached at 80 percent and not before", () => {
    const at = mergeWithinBudget({
      stored: [],
      incoming: [{ start: 0, end: 80 }],
      durationSeconds: 100,
      budgetSeconds: 1000,
    });
    const below = mergeWithinBudget({
      stored: [],
      incoming: [{ start: 0, end: 79.9 }],
      durationSeconds: 100,
      budgetSeconds: 1000,
    });
    expect(reachesCompletion(at.coverage)).toBe(true);
    expect(reachesCompletion(below.coverage)).toBe(false);
  });
});

describe("sequence and resume position", () => {
  test("a newer sequence moves the position and a stale or equal one does not", () => {
    expect(decideSequence(6, 5)).toEqual({ advancesPosition: true, lastSequence: 6 });
    expect(decideSequence(5, 6)).toEqual({ advancesPosition: false, lastSequence: 6 });
    expect(decideSequence(6, 6)).toEqual({ advancesPosition: false, lastSequence: 6 });
  });

  test("the resume position is whole seconds inside the video", () => {
    expect(resumePositionOf(12.9, 100)).toBe(12);
    expect(resumePositionOf(500, 100)).toBe(100);
    expect(resumePositionOf(-3, 100)).toBe(0);
  });
});

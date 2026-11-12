import { maxPlaybackRate } from "@heat/contracts";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
  coveredSeconds,
  mergeWithinBudget,
  normaliseIntervals,
  remainingBudgetSeconds,
} from "../../src/playback/progress-rules";
import { propertyRuns } from "./runs";

const seconds = fc.integer({ min: -5_000, max: 700_000 }).map((ms) => ms / 1000);
const intervalArb = fc.record({ start: seconds, end: seconds });
const intervalsArb = fc.array(intervalArb, { maxLength: 12 });
const durationArb = fc.integer({ min: 1, max: 600_000 }).map((ms) => ms / 1000);

const epsilon = 1e-6;

describe("interval properties", () => {
  test("normalising twice gives the same intervals as normalising once", () => {
    fc.assert(
      fc.property(intervalsArb, durationArb, (intervals, duration) => {
        const once = normaliseIntervals(intervals, duration);
        expect(normaliseIntervals(once, duration)).toEqual(once);
      }),
      propertyRuns,
    );
  });

  test("the order of the intervals does not change the result", () => {
    fc.assert(
      fc.property(intervalsArb, durationArb, (intervals, duration) => {
        const reversed = [...intervals].reverse();
        expect(normaliseIntervals(reversed, duration)).toEqual(
          normaliseIntervals(intervals, duration),
        );
      }),
      propertyRuns,
    );
  });

  test("normalised intervals are sorted, disjoint and inside the duration", () => {
    fc.assert(
      fc.property(intervalsArb, durationArb, (intervals, duration) => {
        const result = normaliseIntervals(intervals, duration);
        result.forEach((interval, index) => {
          expect(interval.start).toBeGreaterThanOrEqual(0);
          expect(interval.end).toBeLessThanOrEqual(duration);
          expect(interval.end).toBeGreaterThan(interval.start);
          const previous = result[index - 1];
          if (previous !== undefined) expect(interval.start).toBeGreaterThan(previous.end);
        });
        expect(coveredSeconds(result)).toBeLessThanOrEqual(duration + epsilon);
      }),
      propertyRuns,
    );
  });

  test("merging the same heartbeat again adds nothing", () => {
    fc.assert(
      fc.property(
        intervalsArb,
        durationArb,
        fc.integer({ min: 0, max: 700_000 }).map((ms) => ms / 1000),
        (incoming, duration, budget) => {
          const first = mergeWithinBudget({
            stored: [],
            incoming,
            durationSeconds: duration,
            budgetSeconds: budget,
          });
          const second = mergeWithinBudget({
            stored: first.merged,
            incoming,
            durationSeconds: duration,
            budgetSeconds: budget,
          });
          expect(coveredSeconds(second.merged)).toBeGreaterThanOrEqual(
            coveredSeconds(first.merged) - epsilon,
          );
          const again = mergeWithinBudget({
            stored: second.merged,
            incoming: first.merged,
            durationSeconds: duration,
            budgetSeconds: 0,
          });
          expect(again.merged).toEqual(second.merged);
          expect(again.acceptedSeconds).toBe(0);
        },
      ),
      propertyRuns,
    );
  });

  test("a zero-length video accepts nothing and has no coverage", () => {
    fc.assert(
      fc.property(intervalsArb, (incoming) => {
        const result = mergeWithinBudget({
          stored: [],
          incoming,
          durationSeconds: 0,
          budgetSeconds: 1_000,
        });
        expect(result).toEqual({ merged: [], acceptedSeconds: 0, coverage: 0 });
      }),
      propertyRuns,
    );
  });

  test("coverage never exceeds the duration or the elapsed time at top speed", () => {
    const heartbeats = fc.array(
      fc.record({
        gapMs: fc.integer({ min: 0, max: 120_000 }),
        intervals: intervalsArb,
      }),
      { minLength: 1, maxLength: 15 },
    );
    fc.assert(
      fc.property(heartbeats, durationArb, (beats, duration) => {
        const startedAt = new Date("2026-01-01T00:00:00.000Z");
        let clock = startedAt.getTime();
        let stored: ReturnType<typeof normaliseIntervals> = [];
        let accepted = 0;
        for (const beat of beats) {
          clock += beat.gapMs;
          const now = new Date(clock);
          const budgetSeconds = remainingBudgetSeconds({
            startedAt,
            now,
            maxRate: maxPlaybackRate,
            acceptedSeconds: accepted,
          });
          const result = mergeWithinBudget({
            stored,
            incoming: beat.intervals,
            durationSeconds: duration,
            budgetSeconds,
          });
          stored = result.merged;
          accepted += result.acceptedSeconds;
          const elapsed = (clock - startedAt.getTime()) / 1000;
          expect(coveredSeconds(stored)).toBeLessThanOrEqual(
            Math.min(duration, elapsed * maxPlaybackRate) + epsilon,
          );
          expect(result.coverage).toBeLessThanOrEqual(1);
        }
      }),
      propertyRuns,
    );
  });
});

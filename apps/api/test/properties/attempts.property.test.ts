import type { LearningModuleState } from "@heat/contracts";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { quizStateOf } from "../../src/learning/learning-rules";
import {
  submissionEligibility,
  type SubmissionFacts,
} from "../../src/learning/quiz-submission-rules";
import { propertyRuns } from "./runs";

const base = new Date("2026-03-01T00:00:00.000Z").getTime();
const minute = 60_000;

const attemptArb = fc.record({
  passed: fc.constantFrom<boolean | null>(true, false, null),
  submittedAt: fc.integer({ min: 0, max: 20_000 }).map((m) => new Date(base + m * minute)),
});

const factsArb: fc.Arbitrary<SubmissionFacts> = fc.record({
  attemptLimit: fc.option(fc.integer({ min: 1, max: 6 }), { nil: null }),
  extraAttempts: fc.integer({ min: 0, max: 4 }),
  waitMinutes: fc.integer({ min: 0, max: 1_440 }),
  attempts: fc.array(attemptArb, { maxLength: 10 }),
});

const nowArb = fc.integer({ min: 0, max: 30_000 }).map((m) => new Date(base + m * minute));

describe("attempt rule properties", () => {
  test("an attempt is eligible only when the limit and the wait time allow it", () => {
    fc.assert(
      fc.property(factsArb, nowArb, (facts, now) => {
        const result = submissionEligibility(facts, now);
        if (result.kind !== "ELIGIBLE") return;
        expect(facts.attempts.some((attempt) => attempt.passed === true)).toBe(false);
        if (facts.attemptLimit !== null) {
          expect(facts.attempts.length).toBeLessThan(facts.attemptLimit + facts.extraAttempts);
        }
        for (const attempt of facts.attempts) {
          if (attempt.passed === false) {
            expect(now.getTime()).toBeGreaterThanOrEqual(
              attempt.submittedAt.getTime() + facts.waitMinutes * minute,
            );
          }
        }
      }),
      propertyRuns,
    );
  });

  test("the limit is reached exactly at the limit plus granted attempts", () => {
    fc.assert(
      fc.property(factsArb, nowArb, (facts, now) => {
        fc.pre(facts.attemptLimit !== null);
        fc.pre(facts.attempts.every((attempt) => attempt.passed !== true));
        const allowed = (facts.attemptLimit ?? 0) + facts.extraAttempts;
        const result = submissionEligibility(facts, now);
        expect(result.kind === "LIMIT_REACHED").toBe(facts.attempts.length >= allowed);
      }),
      propertyRuns,
    );
  });

  test("a granted attempt never reduces what is allowed", () => {
    fc.assert(
      fc.property(factsArb, nowArb, (facts, now) => {
        const granted = submissionEligibility(
          { ...facts, extraAttempts: facts.extraAttempts + 1 },
          now,
        );
        const current = submissionEligibility(facts, now);
        if (current.kind === "ELIGIBLE") expect(granted.kind).toBe("ELIGIBLE");
      }),
      propertyRuns,
    );
  });

  test("a waiting attempt reports a retry time in the future", () => {
    fc.assert(
      fc.property(factsArb, nowArb, (facts, now) => {
        const result = submissionEligibility(facts, now);
        if (result.kind === "WAIT") {
          expect(result.nextAttemptAt.getTime()).toBeGreaterThan(now.getTime());
        }
      }),
      propertyRuns,
    );
  });

  test("the quiz is available only when the module is ready and no limit or wait blocks it", () => {
    fc.assert(
      fc.property(
        factsArb,
        nowArb,
        fc.constantFrom<LearningModuleState>(
          "LOCKED",
          "UNLOCKED",
          "IN_PROGRESS",
          "QUIZ_READY",
          "COMPLETED",
        ),
        (facts, now, moduleState) => {
          const state = quizStateOf(moduleState, facts, now);
          if (state.availability !== "AVAILABLE") return;
          expect(moduleState).toBe("QUIZ_READY");
          if (facts.attemptLimit !== null) {
            expect(facts.attempts.length).toBeLessThan(facts.attemptLimit + facts.extraAttempts);
          }
          expect(state.nextAttemptAt).toBeNull();
        },
      ),
      propertyRuns,
    );
  });
});

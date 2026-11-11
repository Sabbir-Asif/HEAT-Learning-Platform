import { describe, expect, test } from "vitest";
import {
  answersAreValid,
  correctCountOf,
  scoreOf,
  submissionEligibility,
} from "../../src/learning/quiz-submission-rules";

const questions = [
  {
    id: "q1",
    options: [
      { id: "q1a", isCorrect: true },
      { id: "q1b", isCorrect: false },
    ],
  },
  {
    id: "q2",
    options: [
      { id: "q2a", isCorrect: false },
      { id: "q2b", isCorrect: true },
    ],
  },
];

describe("answersAreValid", () => {
  test("accepts answers whose options belong to their questions", () => {
    expect(answersAreValid(questions, { q1: "q1a", q2: "q2a" })).toBe(true);
    expect(answersAreValid(questions, {})).toBe(true);
  });

  test("rejects an option of another question", () => {
    expect(answersAreValid(questions, { q1: "q2a" })).toBe(false);
  });

  test("rejects an unknown question", () => {
    expect(answersAreValid(questions, { other: "q1a" })).toBe(false);
  });
});

describe("correctCountOf", () => {
  test("counts correct answers and treats unanswered questions as wrong", () => {
    expect(correctCountOf(questions, { q1: "q1a", q2: "q2b" })).toBe(2);
    expect(correctCountOf(questions, { q1: "q1a" })).toBe(1);
    expect(correctCountOf(questions, { q1: "q1b" })).toBe(0);
    expect(correctCountOf(questions, {})).toBe(0);
  });
});

describe("scoreOf", () => {
  test("7 of 10 correct passes a 70 percent mark", () => {
    expect(scoreOf(7, 10, 70)).toEqual({
      correctCount: 7,
      totalQuestions: 10,
      scorePercent: 70,
      passed: true,
    });
  });

  test("6 of 10 correct fails a 70 percent mark", () => {
    expect(scoreOf(6, 10, 70)).toMatchObject({ scorePercent: 60, passed: false });
  });

  test("the score percent is rounded down and the pass check uses the exact ratio", () => {
    expect(scoreOf(139, 200, 70)).toMatchObject({ scorePercent: 69, passed: false });
    expect(scoreOf(2, 3, 67)).toMatchObject({ scorePercent: 66, passed: false });
    expect(scoreOf(2, 3, 66)).toMatchObject({ scorePercent: 66, passed: true });
  });

  test("a quiz with no questions scores zero and never passes", () => {
    expect(scoreOf(0, 0, 0)).toMatchObject({ scorePercent: 0, passed: false });
  });

  test("a zero pass mark passes with any answers on a quiz that has questions", () => {
    expect(scoreOf(0, 4, 0)).toMatchObject({ scorePercent: 0, passed: true });
  });
});

describe("submissionEligibility", () => {
  const now = new Date("2026-11-12T10:00:00Z");
  const facts = (
    attempts: { passed: boolean | null; submittedAt: Date }[],
    overrides: Partial<{ attemptLimit: number | null; extraAttempts: number }> = {},
  ) => ({ attemptLimit: null, extraAttempts: 0, waitMinutes: 10, attempts, ...overrides });

  test("is eligible with no submitted attempts", () => {
    expect(submissionEligibility(facts([]), now)).toEqual({ kind: "ELIGIBLE" });
  });

  test("refuses with the next attempt time five minutes into a ten minute wait", () => {
    const failed = { passed: false, submittedAt: new Date("2026-11-12T09:55:00Z") };
    expect(submissionEligibility(facts([failed]), now)).toEqual({
      kind: "WAIT",
      nextAttemptAt: new Date("2026-11-12T10:05:00Z"),
    });
  });

  test("measures the wait from the latest failed attempt", () => {
    const attempts = [
      { passed: false, submittedAt: new Date("2026-11-12T09:30:00Z") },
      { passed: false, submittedAt: new Date("2026-11-12T09:58:00Z") },
      { passed: false, submittedAt: new Date("2026-11-12T09:40:00Z") },
    ];
    expect(submissionEligibility(facts(attempts), now)).toEqual({
      kind: "WAIT",
      nextAttemptAt: new Date("2026-11-12T10:08:00Z"),
    });
  });

  test("is eligible once the wait has passed", () => {
    const failed = { passed: false, submittedAt: new Date("2026-11-12T09:50:00Z") };
    expect(submissionEligibility(facts([failed]), now)).toEqual({ kind: "ELIGIBLE" });
  });

  test("a zero wait never blocks", () => {
    const failed = { passed: false, submittedAt: now };
    expect(submissionEligibility({ ...facts([failed]), waitMinutes: 0 }, now)).toEqual({
      kind: "ELIGIBLE",
    });
  });

  test("refuses with the limit reached when all attempts are used", () => {
    const attempts = [1, 2, 3].map((hour) => ({
      passed: false,
      submittedAt: new Date(`2026-11-12T0${hour}:00:00Z`),
    }));
    expect(submissionEligibility(facts(attempts, { attemptLimit: 3 }), now)).toEqual({
      kind: "LIMIT_REACHED",
    });
  });

  test("granted attempts extend the limit", () => {
    const attempts = [1, 2, 3].map((hour) => ({
      passed: false,
      submittedAt: new Date(`2026-11-12T0${hour}:00:00Z`),
    }));
    expect(
      submissionEligibility(facts(attempts, { attemptLimit: 3, extraAttempts: 1 }), now),
    ).toEqual({ kind: "ELIGIBLE" });
  });

  test("the limit wins over the wait", () => {
    const attempts = [{ passed: false, submittedAt: new Date("2026-11-12T09:59:00Z") }];
    expect(submissionEligibility(facts(attempts, { attemptLimit: 1 }), now)).toEqual({
      kind: "LIMIT_REACHED",
    });
  });

  test("refuses when an earlier attempt already passed", () => {
    const attempts = [{ passed: true, submittedAt: new Date("2026-11-11T09:00:00Z") }];
    expect(submissionEligibility(facts(attempts), now)).toEqual({ kind: "ALREADY_PASSED" });
  });
});

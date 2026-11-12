import { describe, expect, test } from "vitest";
import {
  countdownText,
  remainingSecondsOf,
  resultNextStepOf,
} from "../../src/quiz/quiz-result-view";
import { makeModule, uuid } from "../learn/fixtures";

const quizOf = (overrides: object) => ({
  ...makeModule(1).quiz,
  id: uuid(101),
  availability: "AVAILABLE" as const,
  questionCount: 5,
  passMarkPercent: 70,
  attemptsUsed: 1,
  attemptsAllowed: 3,
  nextAttemptAt: null,
  ...overrides,
});

describe("remainingSecondsOf", () => {
  const now = new Date("2026-11-12T10:00:00.000Z");

  test("rounds a partial second up", () => {
    expect(remainingSecondsOf("2026-11-12T10:00:00.500Z", now)).toBe(1);
  });

  test("never goes below zero", () => {
    expect(remainingSecondsOf("2026-11-12T09:59:00.000Z", now)).toBe(0);
  });
});

describe("countdownText", () => {
  test.each([
    [0, "0:00"],
    [59, "0:59"],
    [600, "10:00"],
    [3725, "1:02:05"],
  ])("formats %i seconds as %s", (seconds, text) => {
    expect(countdownText(seconds)).toBe(text);
  });
});

describe("resultNextStepOf", () => {
  const modules = [makeModule(1), makeModule(2)];

  test("after a pass links to the next module", () => {
    expect(resultNextStepOf(true, modules, 0, "heat")).toEqual({
      kind: "next-module",
      title: "Module 2",
      href: `/learn/heat/${uuid(2)}`,
    });
  });

  test("after a pass on the last module points to the certificate", () => {
    expect(resultNextStepOf(true, modules, 1, "heat")).toEqual({ kind: "certificate" });
  });

  test("after a fail with a waiting time returns the retry time and attempts left", () => {
    const waiting = [
      makeModule(1, {
        quiz: quizOf({ availability: "WAITING", nextAttemptAt: "2026-11-12T10:10:00.000Z" }),
      }),
    ];
    expect(resultNextStepOf(false, waiting, 0, "heat")).toEqual({
      kind: "wait",
      nextAttemptAt: "2026-11-12T10:10:00.000Z",
      retryHref: `/learn/heat/${uuid(1)}/quiz`,
      attemptsRemaining: 2,
    });
  });

  test("after a fail with the limit used says an admin can grant another attempt", () => {
    const exhausted = [
      makeModule(1, { quiz: quizOf({ availability: "EXHAUSTED", attemptsUsed: 3 }) }),
    ];
    expect(resultNextStepOf(false, exhausted, 0, "heat")).toEqual({ kind: "limit-reached" });
  });

  test("after a fail with no waiting time offers a retry", () => {
    const open = [makeModule(1, { quiz: quizOf({}) })];
    expect(resultNextStepOf(false, open, 0, "heat")).toEqual({
      kind: "retry",
      retryHref: `/learn/heat/${uuid(1)}/quiz`,
      attemptsRemaining: 2,
    });
  });

  test("with no attempt cap there is no remaining count", () => {
    const open = [makeModule(1, { quiz: quizOf({ attemptsAllowed: null }) })];
    expect(resultNextStepOf(false, open, 0, "heat")).toMatchObject({
      kind: "retry",
      attemptsRemaining: null,
    });
  });
});

import { describe, expect, test } from "vitest";
import { quizDefaults } from "@heat/contracts";
import { assertOptionsUnlocked, assertRulesUnlocked } from "../../src/catalog/quiz-rules";

const lockedAt = new Date("2026-11-11T06:00:00.000Z");

const options = [
  { text: "A", isCorrect: true },
  { text: "B", isCorrect: false },
];

describe("assertRulesUnlocked", () => {
  test("a changed pass mark, attempt limit or wait on a locked course is refused", () => {
    for (const next of [
      { ...quizDefaults, passMarkPercent: 80 },
      { ...quizDefaults, attemptLimit: 3 },
      { ...quizDefaults, waitMinutes: 0 },
    ]) {
      expect(() => assertRulesUnlocked(lockedAt, quizDefaults, next)).toThrowError(
        expect.objectContaining({ code: "CONTENT_LOCKED" }),
      );
    }
  });

  test("unchanged rules on a locked course pass", () => {
    expect(() => assertRulesUnlocked(lockedAt, quizDefaults, { ...quizDefaults })).not.toThrow();
  });

  test("any change on an unlocked course passes", () => {
    expect(() =>
      assertRulesUnlocked(null, quizDefaults, { ...quizDefaults, passMarkPercent: 50 }),
    ).not.toThrow();
  });
});

describe("assertOptionsUnlocked", () => {
  test("changed option text, a changed correct answer, a different count or order is refused", () => {
    for (const next of [
      [options[0], { text: "B2", isCorrect: false }],
      [
        { text: "A", isCorrect: false },
        { text: "B", isCorrect: true },
      ],
      [options[0]],
      [options[1], options[0]],
      [...options, { text: "C", isCorrect: false }],
    ]) {
      expect(() => assertOptionsUnlocked(lockedAt, options, next as typeof options)).toThrowError(
        expect.objectContaining({ code: "CONTENT_LOCKED" }),
      );
    }
  });

  test("the same options on a locked course pass", () => {
    expect(() =>
      assertOptionsUnlocked(
        lockedAt,
        options,
        options.map((option) => ({ ...option })),
      ),
    ).not.toThrow();
  });

  test("any change on an unlocked course passes", () => {
    expect(() =>
      assertOptionsUnlocked(null, options, [options[1]] as typeof options),
    ).not.toThrow();
  });
});

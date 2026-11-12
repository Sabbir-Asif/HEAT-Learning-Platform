import fc from "fast-check";
import { describe, expect, test } from "vitest";
import {
  correctCountOf,
  scoreOf,
  type ScorableQuestion,
} from "../../src/learning/quiz-submission-rules";
import { propertyRuns } from "./runs";

const totals = fc.integer({ min: 1, max: 200 });
const passMarks = fc.integer({ min: 0, max: 100 });

const scoredCase = fc.tuple(totals, passMarks).chain(([total, passMark]) =>
  fc.record({
    total: fc.constant(total),
    passMark: fc.constant(passMark),
    correct: fc.integer({ min: 0, max: total }),
  }),
);

const questionsArb = fc.array(
  fc.record({
    options: fc.array(fc.boolean(), { minLength: 2, maxLength: 6 }),
    chosen: fc.nat(),
  }),
  { minLength: 1, maxLength: 20 },
);

const build = (
  spec: readonly { options: readonly boolean[]; chosen: number }[],
  reorder: (options: ScorableQuestion["options"]) => ScorableQuestion["options"],
) => {
  const questions: ScorableQuestion[] = spec.map((entry, qi) => ({
    id: `q${qi}`,
    options: reorder(entry.options.map((isCorrect, oi) => ({ id: `q${qi}o${oi}`, isCorrect }))),
  }));
  const answers: Record<string, string> = {};
  spec.forEach((entry, qi) => {
    answers[`q${qi}`] = `q${qi}o${entry.chosen % entry.options.length}`;
  });
  return { questions, answers };
};

describe("scoring properties", () => {
  test("the score is always within 0 and 100", () => {
    fc.assert(
      fc.property(scoredCase, ({ total, passMark, correct }) => {
        const { scorePercent } = scoreOf(correct, total, passMark);
        expect(scorePercent).toBeGreaterThanOrEqual(0);
        expect(scorePercent).toBeLessThanOrEqual(100);
      }),
      propertyRuns,
    );
  });

  test("an attempt passes exactly when its score reaches the pass mark", () => {
    fc.assert(
      fc.property(scoredCase, ({ total, passMark, correct }) => {
        const result = scoreOf(correct, total, passMark);
        expect(result.passed).toBe(result.scorePercent >= passMark);
      }),
      propertyRuns,
    );
  });

  test("more correct answers never turn a pass into a fail", () => {
    fc.assert(
      fc.property(scoredCase, ({ total, passMark, correct }) => {
        fc.pre(correct < total);
        const lower = scoreOf(correct, total, passMark);
        const higher = scoreOf(correct + 1, total, passMark);
        expect(higher.scorePercent).toBeGreaterThanOrEqual(lower.scorePercent);
        expect(!lower.passed || higher.passed).toBe(true);
      }),
      propertyRuns,
    );
  });

  test("a quiz without questions scores zero and never passes", () => {
    fc.assert(
      fc.property(passMarks, (passMark) => {
        expect(scoreOf(0, 0, passMark)).toMatchObject({ scorePercent: 0, passed: false });
      }),
      propertyRuns,
    );
  });

  test("the order of the options does not change the score", () => {
    fc.assert(
      fc.property(
        questionsArb,
        fc.array(fc.nat(), { minLength: 6, maxLength: 6 }),
        (spec, keys) => {
          const original = build(spec, (options) => options);
          const shuffled = build(spec, (options) =>
            options
              .map((option, index) => ({ option, key: keys[index % keys.length] ?? 0, index }))
              .sort((a, b) => a.key - b.key || b.index - a.index)
              .map((entry) => entry.option),
          );
          const before = correctCountOf(original.questions, original.answers);
          const after = correctCountOf(shuffled.questions, shuffled.answers);
          expect(after).toBe(before);
          expect(before).toBeLessThanOrEqual(spec.length);
        },
      ),
      propertyRuns,
    );
  });
});

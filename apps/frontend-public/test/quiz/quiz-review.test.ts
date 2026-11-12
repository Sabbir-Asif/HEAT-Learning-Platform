import { describe, expect, test } from "vitest";
import {
  answeredCountOf,
  answeredPercentOf,
  firstUnansweredIndex,
  unansweredOf,
} from "../../src/quiz/quiz-review";

const questions = ["q1", "q2", "q3", "q4", "q5"].map((id, index) => ({
  id,
  text: `Text ${index + 1}`,
}));

describe("unansweredOf", () => {
  test("lists the two unanswered questions of five with number and index", () => {
    expect(unansweredOf(questions, { q1: "a", q3: "b", q5: "c" })).toEqual([
      { id: "q2", number: 2, index: 1, text: "Text 2" },
      { id: "q4", number: 4, index: 3, text: "Text 4" },
    ]);
  });

  test("is empty when everything is answered", () => {
    expect(unansweredOf(questions, { q1: "a", q2: "a", q3: "a", q4: "a", q5: "a" })).toEqual([]);
  });
});

describe("answeredCountOf and firstUnansweredIndex", () => {
  test("count answered questions", () => {
    expect(answeredCountOf(questions, { q1: "a", q3: "b", q5: "c" })).toBe(3);
  });

  test("point at the first gap, or past the end when none", () => {
    expect(firstUnansweredIndex(questions, { q1: "a" })).toBe(1);
    expect(firstUnansweredIndex(questions, {})).toBe(0);
    expect(firstUnansweredIndex(questions, { q1: "a", q2: "a", q3: "a", q4: "a", q5: "a" })).toBe(
      5,
    );
  });
});

describe("answeredPercentOf", () => {
  test("rounds and guards an empty quiz", () => {
    expect(answeredPercentOf(3, 5)).toBe(60);
    expect(answeredPercentOf(1, 3)).toBe(33);
    expect(answeredPercentOf(0, 0)).toBe(0);
    expect(answeredPercentOf(9, 5)).toBe(100);
  });
});

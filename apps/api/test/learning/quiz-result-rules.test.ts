import { describe, expect, test } from "vitest";
import { resultReviewOf } from "../../src/learning/quiz-result-rules";

const questions = [
  {
    id: "q1",
    order: 1,
    text: "First",
    explanation: "Because one",
    options: [
      { id: "q1a", text: "A", isCorrect: true },
      { id: "q1b", text: "B", isCorrect: false },
    ],
  },
  {
    id: "q2",
    order: 2,
    text: "Second",
    explanation: null,
    options: [
      { id: "q2a", text: "C", isCorrect: false },
      { id: "q2b", text: "D", isCorrect: true },
    ],
  },
];

describe("resultReviewOf", () => {
  test("returns nothing for a failed attempt", () => {
    expect(resultReviewOf(false, questions, { q1: "q1a", q2: "q2b" })).toBeNull();
  });

  test("returns nothing while the attempt has no verdict", () => {
    expect(resultReviewOf(null, questions, {})).toBeNull();
  });

  test("returns the chosen and correct option with the explanation for a pass", () => {
    expect(resultReviewOf(true, questions, { q1: "q1a", q2: "q2a" })).toEqual([
      {
        questionId: "q1",
        text: "First",
        explanation: "Because one",
        selectedOptionId: "q1a",
        correctOptionId: "q1a",
        options: [
          { id: "q1a", text: "A" },
          { id: "q1b", text: "B" },
        ],
      },
      {
        questionId: "q2",
        text: "Second",
        explanation: null,
        selectedOptionId: "q2a",
        correctOptionId: "q2b",
        options: [
          { id: "q2a", text: "C" },
          { id: "q2b", text: "D" },
        ],
      },
    ]);
  });

  test("marks an unanswered question with no selection", () => {
    const review = resultReviewOf(true, questions, { q1: "q1a" });
    expect(review?.[1]?.selectedOptionId).toBeNull();
  });
});

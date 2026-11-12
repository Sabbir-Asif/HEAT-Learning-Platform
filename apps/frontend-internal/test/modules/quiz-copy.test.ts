import { describe, expect, test } from "vitest";
import {
  attemptLimitOf,
  correctAfterRemoval,
  numberOf,
  questionFormValuesOf,
  questionSaveFailedMessage,
} from "../../src/modules/quiz-copy";

describe("questionFormValuesOf", () => {
  test("starts a new question with two empty options and no correct choice", () => {
    expect(questionFormValuesOf(null)).toEqual({
      text: "",
      explanation: "",
      options: [{ text: "" }, { text: "" }],
      correct: "",
    });
  });

  test("fills the form from a saved question and points at the correct option", () => {
    expect(
      questionFormValuesOf({
        text: "Which?",
        explanation: null,
        options: [
          { text: "A", isCorrect: false },
          { text: "B", isCorrect: true },
        ],
      }),
    ).toEqual({
      text: "Which?",
      explanation: "",
      options: [{ text: "A" }, { text: "B" }],
      correct: "1",
    });
  });
});

describe("correctAfterRemoval", () => {
  test("clears the choice when the correct option is removed", () => {
    expect(correctAfterRemoval("1", 1)).toBe("");
  });

  test("shifts the choice down when an earlier option is removed", () => {
    expect(correctAfterRemoval("2", 0)).toBe("1");
  });

  test("keeps the choice when a later option is removed", () => {
    expect(correctAfterRemoval("0", 2)).toBe("0");
  });

  test("keeps an empty choice empty", () => {
    expect(correctAfterRemoval("", 0)).toBe("");
  });
});

describe("numberOf and attemptLimitOf", () => {
  test("a blank number input is not a number", () => {
    expect(Number.isNaN(numberOf(" "))).toBe(true);
    expect(numberOf("12")).toBe(12);
  });

  test("a blank attempt limit means unlimited", () => {
    expect(attemptLimitOf("")).toBeNull();
    expect(attemptLimitOf("3")).toBe(3);
  });
});

describe("questionSaveFailedMessage", () => {
  test("explains a locked course", () => {
    expect(questionSaveFailedMessage("CONTENT_LOCKED")).toMatch(/locked/i);
  });

  test("falls back to a retry message", () => {
    expect(questionSaveFailedMessage(undefined)).toMatch(/try again/i);
  });
});

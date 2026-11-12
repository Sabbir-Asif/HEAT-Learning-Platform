import { describe, expect, test } from "vitest";
import {
  questionFormSchema,
  questionRequestOf,
  quizDefaults,
  quizQuestionRequestSchema,
  quizRulesRequestSchema,
} from "../src/index";

const option = (text: string, isCorrect = false) => ({ text, isCorrect });

const options = (count: number, correct = 1) =>
  Array.from({ length: count }, (_, index) => option(`Option ${index + 1}`, index < correct));

describe("quizDefaults", () => {
  test("pass mark 70, unlimited attempts, wait 10 minutes", () => {
    expect(quizDefaults).toEqual({ passMarkPercent: 70, attemptLimit: null, waitMinutes: 10 });
  });
});

describe("quizQuestionRequestSchema", () => {
  test("accepts a question with two to six options and one correct", () => {
    for (const count of [2, 3, 6]) {
      expect(
        quizQuestionRequestSchema.safeParse({ text: "Which?", options: options(count) }).success,
      ).toBe(true);
    }
  });

  test("defaults the type to single choice and the explanation to null", () => {
    const parsed = quizQuestionRequestSchema.parse({ text: "Which?", options: options(2) });
    expect(parsed.type).toBe("SINGLE_CHOICE");
    expect(parsed.explanation).toBeNull();
  });

  test("rejects one option and seven options", () => {
    for (const count of [1, 7]) {
      const result = quizQuestionRequestSchema.safeParse({
        text: "Which?",
        options: options(count),
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(["options"]);
    }
  });

  test("rejects zero correct options and two correct options", () => {
    for (const correct of [0, 2]) {
      const result = quizQuestionRequestSchema.safeParse({
        text: "Which?",
        options: options(3, correct),
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(["options"]);
    }
  });

  test("rejects blank text and a blank option", () => {
    expect(quizQuestionRequestSchema.safeParse({ text: "  ", options: options(2) }).success).toBe(
      false,
    );
    expect(
      quizQuestionRequestSchema.safeParse({
        text: "Which?",
        options: [option("", true), option("B")],
      }).success,
    ).toBe(false);
  });

  test("turns a blank explanation into null and keeps a written one", () => {
    expect(
      quizQuestionRequestSchema.parse({ text: "Q", explanation: "  ", options: options(2) })
        .explanation,
    ).toBeNull();
    expect(
      quizQuestionRequestSchema.parse({ text: "Q", explanation: " Because ", options: options(2) })
        .explanation,
    ).toBe("Because");
  });
});

describe("quizRulesRequestSchema", () => {
  test("accepts the defaults and an attempt limit", () => {
    expect(quizRulesRequestSchema.safeParse(quizDefaults).success).toBe(true);
    expect(quizRulesRequestSchema.safeParse({ ...quizDefaults, attemptLimit: 3 }).success).toBe(
      true,
    );
  });

  test("rejects a pass mark outside 1 to 100", () => {
    for (const passMarkPercent of [0, 101, 70.5]) {
      expect(quizRulesRequestSchema.safeParse({ ...quizDefaults, passMarkPercent }).success).toBe(
        false,
      );
    }
    for (const passMarkPercent of [1, 100]) {
      expect(quizRulesRequestSchema.safeParse({ ...quizDefaults, passMarkPercent }).success).toBe(
        true,
      );
    }
  });

  test("rejects a negative wait and accepts zero", () => {
    expect(quizRulesRequestSchema.safeParse({ ...quizDefaults, waitMinutes: -1 }).success).toBe(
      false,
    );
    expect(quizRulesRequestSchema.safeParse({ ...quizDefaults, waitMinutes: 0 }).success).toBe(
      true,
    );
  });

  test("rejects an attempt limit below 1", () => {
    for (const attemptLimit of [0, -2]) {
      expect(quizRulesRequestSchema.safeParse({ ...quizDefaults, attemptLimit }).success).toBe(
        false,
      );
    }
  });
});

describe("questionFormSchema and questionRequestOf", () => {
  const values = {
    text: "Which?",
    explanation: "",
    options: [{ text: "A" }, { text: "B" }, { text: "C" }],
    correct: "1",
  };

  test("accepts a valid form", () => {
    expect(questionFormSchema.safeParse(values).success).toBe(true);
  });

  test("rejects when the correct choice points at no option", () => {
    expect(questionFormSchema.safeParse({ ...values, correct: "5" }).success).toBe(false);
    expect(questionFormSchema.safeParse({ ...values, correct: "" }).success).toBe(false);
  });

  test("rejects a count of options outside 2 to 6", () => {
    expect(
      questionFormSchema.safeParse({ ...values, options: [{ text: "A" }], correct: "0" }).success,
    ).toBe(false);
  });

  test("builds the request with exactly one correct option", () => {
    const request = questionRequestOf(questionFormSchema.parse(values));
    expect(request.options.map((item) => item.isCorrect)).toEqual([false, true, false]);
    expect(request.explanation).toBe("");
  });
});

import { describe, expect, test } from "vitest";
import {
  quizDeliveryAvailableSchema,
  quizDeliveryOptionSchema,
  quizDeliveryParamsSchema,
  quizDeliveryQuestionSchema,
  quizDeliveryResponseSchema,
} from "../src/quiz-delivery";

const id = "0192f3a4-7b2c-7d3e-8f10-aabbccddeeff";

const available = {
  status: "AVAILABLE",
  attemptsUsed: 0,
  attemptsAllowed: 10,
  quiz: { id, passMarkPercent: 70 },
  attempt: { id, startedAt: "2026-11-12T04:00:00.000Z" },
  questions: [{ id, order: 1, text: "Q", options: [{ id, text: "A" }] }],
};

const keysOf = (schema: { shape: Record<string, unknown> }) => Object.keys(schema.shape).sort();

describe("quiz delivery schemas", () => {
  test("an option carries only its id and text", () => {
    expect(keysOf(quizDeliveryOptionSchema)).toEqual(["id", "text"]);
  });

  test("a question carries only id, order, text and options", () => {
    expect(keysOf(quizDeliveryQuestionSchema)).toEqual(["id", "options", "order", "text"]);
  });

  test("no schema in the delivery response names a correct flag or an explanation", () => {
    const names = JSON.stringify(
      [
        quizDeliveryAvailableSchema.shape,
        quizDeliveryQuestionSchema.shape,
        quizDeliveryOptionSchema.shape,
      ].map((shape) => Object.keys(shape)),
    ).toLowerCase();
    expect(names).not.toContain("correct");
    expect(names).not.toContain("explanation");
  });

  test("parsing strips a correct flag and an explanation that leak in", () => {
    const parsed = quizDeliveryResponseSchema.parse({
      ...available,
      questions: [
        {
          id,
          order: 1,
          text: "Q",
          explanation: "because",
          options: [{ id, text: "A", isCorrect: true }],
        },
      ],
    });
    const text = JSON.stringify(parsed);
    expect(text).not.toContain("isCorrect");
    expect(text).not.toContain("explanation");
  });

  test("the four states parse and an unknown state is refused", () => {
    expect(quizDeliveryResponseSchema.safeParse(available).success).toBe(true);
    expect(
      quizDeliveryResponseSchema.safeParse({
        status: "WAITING",
        attemptsUsed: 1,
        attemptsAllowed: 10,
        nextAttemptAt: "2026-11-12T04:10:00.000Z",
      }).success,
    ).toBe(true);
    expect(
      quizDeliveryResponseSchema.safeParse({
        status: "EXHAUSTED",
        attemptsUsed: 10,
        attemptsAllowed: 10,
      }).success,
    ).toBe(true);
    expect(
      quizDeliveryResponseSchema.safeParse({
        status: "PASSED",
        attemptsUsed: 1,
        attemptsAllowed: null,
        passMarkPercent: 70,
        bestResult: null,
      }).success,
    ).toBe(true);
    expect(quizDeliveryResponseSchema.safeParse({ status: "OTHER" }).success).toBe(false);
  });

  test("the waiting state needs the next attempt time", () => {
    expect(
      quizDeliveryResponseSchema.safeParse({
        status: "WAITING",
        attemptsUsed: 1,
        attemptsAllowed: 10,
      }).success,
    ).toBe(false);
  });

  test("params need a course id and a module id", () => {
    expect(quizDeliveryParamsSchema.safeParse({ courseId: id, moduleId: id }).success).toBe(true);
    expect(quizDeliveryParamsSchema.safeParse({ courseId: id }).success).toBe(false);
  });
});

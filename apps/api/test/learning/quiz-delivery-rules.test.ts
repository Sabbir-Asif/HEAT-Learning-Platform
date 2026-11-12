import { describe, expect, test } from "vitest";
import {
  attemptIdempotencyKey,
  bestResultOf,
  deliverQuestions,
  isUniqueViolation,
  seededShuffle,
} from "../../src/learning/quiz-delivery-rules";

const items = Array.from({ length: 8 }, (_, index) => index);

describe("seededShuffle", () => {
  test("returns the same order for the same seed", () => {
    expect(seededShuffle(items, "a1")).toEqual(seededShuffle(items, "a1"));
  });

  test("keeps every item exactly once and leaves the input untouched", () => {
    const shuffled = seededShuffle(items, "a1");
    expect([...shuffled].sort()).toEqual(items);
    expect(items).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  test("varies across seeds", () => {
    const orders = new Set(
      Array.from({ length: 20 }, (_, index) => seededShuffle(items, `attempt-${index}`).join()),
    );
    expect(orders.size).toBeGreaterThan(10);
  });

  test("handles empty and single lists", () => {
    expect(seededShuffle([], "x")).toEqual([]);
    expect(seededShuffle([1], "x")).toEqual([1]);
  });
});

const questions = [
  {
    id: "q1",
    order: 1,
    text: "First",
    options: ["a", "b", "c", "d", "e", "f"].map((id) => ({
      id,
      text: id.toUpperCase(),
      isCorrect: id === "a",
      extra: "x",
    })),
  },
];

describe("deliverQuestions", () => {
  test("outputs only id, order, text and option id and text", () => {
    const [question] = deliverQuestions("attempt-one", questions);
    expect(Object.keys(question ?? {}).sort()).toEqual(["id", "options", "order", "text"]);
    for (const option of question?.options ?? []) {
      expect(Object.keys(option).sort()).toEqual(["id", "text"]);
    }
    expect(JSON.stringify(question)).not.toContain("isCorrect");
  });

  test("is stable within an attempt and differs across attempts", () => {
    const first = deliverQuestions("attempt-one", questions);
    expect(deliverQuestions("attempt-one", questions)).toEqual(first);
    const orders = new Set(
      Array.from({ length: 12 }, (_, index) =>
        deliverQuestions(`attempt-${index}`, questions)[0]
          ?.options.map((o) => o.id)
          .join(),
      ),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  test("keeps option ids attached to their text", () => {
    const [question] = deliverQuestions("attempt-two", questions);
    for (const option of question?.options ?? []) {
      expect(option.text).toBe(option.id.toUpperCase());
    }
  });
});

describe("attemptIdempotencyKey", () => {
  test("is the next attempt number", () => {
    expect(attemptIdempotencyKey(0)).toBe("attempt-1");
    expect(attemptIdempotencyKey(3)).toBe("attempt-4");
  });
});

describe("bestResultOf", () => {
  const at = (iso: string) => new Date(iso);

  test("is null without a scored attempt", () => {
    expect(bestResultOf([])).toBeNull();
    expect(
      bestResultOf([{ id: "a", scorePercent: null, passed: null, submittedAt: null }]),
    ).toBeNull();
  });

  test("picks the highest score", () => {
    expect(
      bestResultOf([
        { id: "a", scorePercent: 40, passed: false, submittedAt: at("2026-11-12T01:00:00Z") },
        { id: "b", scorePercent: 80, passed: true, submittedAt: at("2026-11-12T02:00:00Z") },
        { id: "c", scorePercent: 60, passed: false, submittedAt: at("2026-11-12T03:00:00Z") },
      ]),
    ).toEqual({
      attemptId: "b",
      scorePercent: 80,
      passed: true,
      submittedAt: "2026-11-12T02:00:00.000Z",
    });
  });
});

describe("isUniqueViolation", () => {
  test("recognises the Prisma unique code only", () => {
    expect(isUniqueViolation({ code: "P2002" })).toBe(true);
    expect(isUniqueViolation({ code: "P2025" })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation("P2002")).toBe(false);
  });
});

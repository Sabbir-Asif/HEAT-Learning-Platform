import { describe, expect, test } from "vitest";
import {
  answerStorageKey,
  browserStorage,
  createAnswerStore,
  restoreAnswers,
} from "../../src/quiz/quiz-answer-store";
import { memoryStorage, throwingStorage } from "./memory-storage";

const questions = [
  { id: "q1", options: [{ id: "a" }, { id: "b" }] },
  { id: "q2", options: [{ id: "c" }, { id: "d" }] },
];

describe("createAnswerStore", () => {
  test("restores the saved answers for the same attempt", () => {
    const storage = memoryStorage();
    createAnswerStore("att1", questions, storage).save({ q1: "b", q2: "c" });
    expect(createAnswerStore("att1", questions, storage).load()).toEqual({ q1: "b", q2: "c" });
  });

  test("keeps attempts apart", () => {
    const storage = memoryStorage();
    createAnswerStore("att1", questions, storage).save({ q1: "a" });
    expect(createAnswerStore("att2", questions, storage).load()).toEqual({});
  });

  test("clear removes the saved answers", () => {
    const storage = memoryStorage();
    const store = createAnswerStore("att1", questions, storage);
    store.save({ q1: "a" });
    store.clear();
    expect(storage.entries.has(answerStorageKey("att1"))).toBe(false);
    expect(store.load()).toEqual({});
  });

  test("works without storage", () => {
    const store = createAnswerStore("att1", questions, null);
    store.save({ q1: "a" });
    store.clear();
    expect(store.load()).toEqual({});
  });

  test("survives storage that throws on every call", () => {
    const store = createAnswerStore("att1", questions, throwingStorage());
    expect(() => store.save({ q1: "a" })).not.toThrow();
    expect(() => store.clear()).not.toThrow();
    expect(store.load()).toEqual({});
  });
});

describe("restoreAnswers", () => {
  test("returns nothing for missing, broken or non-object data", () => {
    expect(restoreAnswers(null, questions)).toEqual({});
    expect(restoreAnswers("{", questions)).toEqual({});
    expect(restoreAnswers("[1]", questions)).toEqual({});
    expect(restoreAnswers("5", questions)).toEqual({});
  });

  test("drops answers for unknown questions and options that do not belong", () => {
    expect(restoreAnswers(JSON.stringify({ q1: "c", q2: "d", q3: "a", q9: 4 }), questions)).toEqual(
      { q2: "d" },
    );
  });
});

describe("browserStorage", () => {
  test("is null when the browser refuses access to local storage", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => {
        throw new Error("denied");
      },
    });
    try {
      expect(browserStorage()).toBeNull();
    } finally {
      if (original) Object.defineProperty(window, "localStorage", original);
    }
  });
});

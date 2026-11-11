import type { StorageLike } from "../../src/quiz/quiz-answer-store";

export const memoryStorage = (
  seed: Record<string, string> = {},
): StorageLike & {
  entries: Map<string, string>;
} => {
  const entries = new Map(Object.entries(seed));
  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, value),
    removeItem: (key) => void entries.delete(key),
  };
};

export const throwingStorage = (): StorageLike => ({
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
});

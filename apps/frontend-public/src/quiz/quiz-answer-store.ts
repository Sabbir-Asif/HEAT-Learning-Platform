export type QuizAnswers = Readonly<Record<string, string>>;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AnswerableQuestion {
  id: string;
  options: readonly { id: string }[];
}

export interface QuizAnswerStore {
  load(): QuizAnswers;
  save(answers: QuizAnswers): void;
  clear(): void;
}

export const answerStorageKey = (attemptId: string): string => `heat.quiz.answers.${attemptId}`;

export const browserStorage = (): StorageLike | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const restoreAnswers = (
  raw: string | null,
  questions: readonly AnswerableQuestion[],
): QuizAnswers => {
  if (raw === null) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!isRecord(parsed)) return {};
  const restored: Record<string, string> = {};
  for (const question of questions) {
    const optionId = parsed[question.id];
    if (typeof optionId === "string" && question.options.some((option) => option.id === optionId)) {
      restored[question.id] = optionId;
    }
  }
  return restored;
};

export const createAnswerStore = (
  attemptId: string,
  questions: readonly AnswerableQuestion[],
  storage: StorageLike | null,
): QuizAnswerStore => {
  const key = answerStorageKey(attemptId);
  return {
    load() {
      if (storage === null) return {};
      try {
        return restoreAnswers(storage.getItem(key), questions);
      } catch {
        return {};
      }
    },
    save(answers) {
      if (storage === null) return;
      try {
        storage.setItem(key, JSON.stringify(answers));
      } catch {
        return;
      }
    },
    clear() {
      if (storage === null) return;
      try {
        storage.removeItem(key);
      } catch {
        return;
      }
    },
  };
};

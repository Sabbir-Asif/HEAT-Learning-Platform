import type { QuestionFormValues } from "@heat/contracts";

export const quizLockedMessage =
  "This course is locked. Options, correct answers and quiz rules cannot change, and questions cannot be added, removed or reordered. Wording changes to question text and explanations are logged.";

export const questionDeleteFailedMessage = (text: string): string =>
  `${text} could not be removed. Try again.`;

export const questionSaveFailedMessage = (code: string | undefined): string =>
  code === "CONTENT_LOCKED"
    ? "This course is locked, so options and correct answers cannot change."
    : "The question could not be saved. Try again.";

export const questionFormValuesOf = (
  question: {
    text: string;
    explanation: string | null;
    options: ReadonlyArray<{ text: string; isCorrect: boolean }>;
  } | null,
): QuestionFormValues => {
  if (question === null) {
    return { text: "", explanation: "", options: [{ text: "" }, { text: "" }], correct: "" };
  }
  const correct = question.options.findIndex((option) => option.isCorrect);
  return {
    text: question.text,
    explanation: question.explanation ?? "",
    options: question.options.map((option) => ({ text: option.text })),
    correct: correct === -1 ? "" : String(correct),
  };
};

export const correctAfterRemoval = (correct: string, removedIndex: number): string => {
  if (correct === "") return "";
  const current = Number(correct);
  if (current === removedIndex) return "";
  return current > removedIndex ? String(current - 1) : correct;
};

export const numberOf = (raw: string): number => (raw.trim() === "" ? Number.NaN : Number(raw));

export const attemptLimitOf = (raw: string): number | null =>
  raw.trim() === "" ? null : Number(raw);

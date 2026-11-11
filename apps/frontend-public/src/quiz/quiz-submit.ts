import { isApiError } from "@heat/api-client";
import type { QuizSubmitRequest, QuizSubmitResponse } from "@heat/contracts";
import type { QuizAnswers } from "./quiz-answer-store";

export interface QuizSubmission {
  attemptId: string;
  answers: QuizAnswers;
}

export type QuizSubmitOutcome =
  | { status: "SUBMITTED"; attemptId: string }
  | { status: "WAITING"; nextAttemptAt: string | null }
  | { status: "EXHAUSTED" }
  | { status: "CLOSED" }
  | { status: "FAILED" };

export type SubmitQuiz = (submission: QuizSubmission) => Promise<QuizSubmitOutcome>;

export interface QuizSubmitDependencies {
  send: (request: QuizSubmitRequest) => Promise<QuizSubmitResponse>;
  onSubmitted: () => void;
}

const closedCodes: readonly string[] = [
  "QUIZ_ATTEMPT_NOT_OPEN",
  "QUIZ_ANSWER_INVALID",
  "QUIZ_NOT_UNLOCKED",
  "ENROLLMENT_NOT_ACTIVE",
  "NOT_FOUND",
];

export const outcomeOfSubmitError = (error: unknown): QuizSubmitOutcome => {
  if (!isApiError(error)) return { status: "FAILED" };
  if (error.code === "QUIZ_ATTEMPT_WAIT") {
    return { status: "WAITING", nextAttemptAt: error.details?.nextAttemptAt ?? null };
  }
  if (error.code === "QUIZ_ATTEMPT_LIMIT_REACHED") return { status: "EXHAUSTED" };
  if (closedCodes.includes(error.code)) return { status: "CLOSED" };
  return { status: "FAILED" };
};

export const createQuizSubmit =
  ({ send, onSubmitted }: QuizSubmitDependencies): SubmitQuiz =>
  async ({ attemptId, answers }) => {
    try {
      const result = await send({ attemptId, idempotencyKey: attemptId, answers });
      onSubmitted();
      return { status: "SUBMITTED", attemptId: result.attemptId };
    } catch (error) {
      return outcomeOfSubmitError(error);
    }
  };

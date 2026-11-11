import type { QuizAnswers } from "./quiz-answer-store";

export interface QuizSubmission {
  attemptId: string;
  answers: QuizAnswers;
}

export type QuizSubmitOutcome =
  { status: "SUBMITTED"; attemptId: string } | { status: "UNAVAILABLE" } | { status: "FAILED" };

export type SubmitQuiz = (submission: QuizSubmission) => Promise<QuizSubmitOutcome>;

export const submitQuiz: SubmitQuiz = async () => ({ status: "UNAVAILABLE" });

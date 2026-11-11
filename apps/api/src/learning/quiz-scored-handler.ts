import type { HeatClient } from "@heat/db";
import type { ScoredQuizAttempt } from "./quiz-submission-rules";

export type QuizScoringTransaction = Pick<
  HeatClient,
  | "enrollment"
  | "module"
  | "moduleProgress"
  | "quiz"
  | "quizAttempt"
  | "attemptGrant"
  | "answer"
  | "outbox"
  | "$queryRaw"
  | "$executeRaw"
>;

export interface QuizScoredEvent {
  tx: QuizScoringTransaction;
  userId: string;
  courseId: string;
  moduleId: string;
  enrollmentId: string;
  quizId: string;
  result: ScoredQuizAttempt;
}

export interface QuizScoredHandler {
  onQuizScored(event: QuizScoredEvent): Promise<void>;
}

export const QUIZ_SCORED_HANDLERS = Symbol("QUIZ_SCORED_HANDLERS");

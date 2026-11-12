import type { QuizAnswers } from "./quiz-answer-store";

export interface ReviewQuestion {
  id: string;
  text: string;
}

export interface UnansweredQuestion {
  id: string;
  number: number;
  index: number;
  text: string;
}

export const unansweredOf = (
  questions: readonly ReviewQuestion[],
  answers: QuizAnswers,
): UnansweredQuestion[] =>
  questions.flatMap((question, index) =>
    answers[question.id] === undefined
      ? [{ id: question.id, number: index + 1, index, text: question.text }]
      : [],
  );

export const answeredCountOf = (
  questions: readonly ReviewQuestion[],
  answers: QuizAnswers,
): number => questions.length - unansweredOf(questions, answers).length;

export const firstUnansweredIndex = (
  questions: readonly ReviewQuestion[],
  answers: QuizAnswers,
): number => unansweredOf(questions, answers)[0]?.index ?? questions.length;

export const answeredPercentOf = (answered: number, total: number): number =>
  total === 0 ? 0 : Math.min(100, Math.round((answered / total) * 100));

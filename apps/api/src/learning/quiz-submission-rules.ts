export interface ScorableOption {
  id: string;
  isCorrect: boolean;
}

export interface ScorableQuestion {
  id: string;
  options: readonly ScorableOption[];
}

export interface SubmissionFacts {
  attemptLimit: number | null;
  extraAttempts: number;
  waitMinutes: number;
  attempts: readonly { passed: boolean | null; submittedAt: Date }[];
}

export type SubmissionEligibility =
  | { kind: "ELIGIBLE" }
  | { kind: "ALREADY_PASSED" }
  | { kind: "LIMIT_REACHED" }
  | { kind: "WAIT"; nextAttemptAt: Date };

export interface QuizScore {
  correctCount: number;
  totalQuestions: number;
  scorePercent: number;
  passed: boolean;
}

export interface ScoredQuizAttempt extends QuizScore {
  attemptId: string;
  passMarkPercent: number;
}

const minute = 60_000;

export const answersAreValid = (
  questions: readonly ScorableQuestion[],
  answers: Readonly<Record<string, string>>,
): boolean => {
  const byQuestion = new Map(questions.map((question) => [question.id, question]));
  return Object.entries(answers).every(([questionId, optionId]) =>
    byQuestion.get(questionId)?.options.some((option) => option.id === optionId) === true,
  );
};

export const correctCountOf = (
  questions: readonly ScorableQuestion[],
  answers: Readonly<Record<string, string>>,
): number =>
  questions.filter((question) =>
    question.options.some((option) => option.isCorrect && answers[question.id] === option.id),
  ).length;

export const scoreOf = (
  correctCount: number,
  totalQuestions: number,
  passMarkPercent: number,
): QuizScore => ({
  correctCount,
  totalQuestions,
  scorePercent: totalQuestions === 0 ? 0 : Math.floor((correctCount * 100) / totalQuestions),
  passed: totalQuestions > 0 && correctCount * 100 >= passMarkPercent * totalQuestions,
});

export const submissionEligibility = (
  facts: SubmissionFacts,
  now: Date,
): SubmissionEligibility => {
  if (facts.attempts.some((attempt) => attempt.passed === true)) return { kind: "ALREADY_PASSED" };
  if (
    facts.attemptLimit !== null &&
    facts.attempts.length >= facts.attemptLimit + facts.extraAttempts
  ) {
    return { kind: "LIMIT_REACHED" };
  }
  const lastFailed = facts.attempts.reduce<Date | null>(
    (latest, attempt) =>
      attempt.passed === false && (latest === null || attempt.submittedAt > latest)
        ? attempt.submittedAt
        : latest,
    null,
  );
  if (lastFailed !== null) {
    const nextAttemptAt = new Date(lastFailed.getTime() + facts.waitMinutes * minute);
    if (nextAttemptAt > now) return { kind: "WAIT", nextAttemptAt };
  }
  return { kind: "ELIGIBLE" };
};

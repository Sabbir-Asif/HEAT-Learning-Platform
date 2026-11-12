import type { QuizResultReviewQuestion } from "@heat/contracts";

export interface ReviewableQuestion {
  id: string;
  order: number;
  text: string;
  explanation: string | null;
  options: readonly { id: string; text: string; isCorrect: boolean }[];
}

export const resultReviewOf = (
  passed: boolean | null,
  questions: readonly ReviewableQuestion[],
  answers: Readonly<Record<string, string>>,
): QuizResultReviewQuestion[] | null => {
  if (passed !== true) return null;
  return questions.flatMap((question) => {
    const correct = question.options.find((option) => option.isCorrect);
    if (correct === undefined) return [];
    return [
      {
        questionId: question.id,
        text: question.text,
        explanation: question.explanation,
        selectedOptionId: answers[question.id] ?? null,
        correctOptionId: correct.id,
        options: question.options.map((option) => ({ id: option.id, text: option.text })),
      },
    ];
  });
};

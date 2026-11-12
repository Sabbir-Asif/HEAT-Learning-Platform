"use client";

import { useQuizGet } from "@heat/api-client";
import { CardDescription, EmptyState, ErrorState, QuizPreview, Skeleton } from "@heat/ui";
import { CircleHelpIcon } from "lucide-react";

type QuizPreviewPanelProps = { courseId: string; moduleId: string };

export function QuizPreviewPanel({ courseId, moduleId }: QuizPreviewPanelProps) {
  const quiz = useQuizGet(courseId, moduleId);
  if (quiz.isPending) return <Skeleton className="h-40 w-full" />;
  if (quiz.isError) {
    return <ErrorState title="The quiz could not be loaded" onRetry={() => void quiz.refetch()} />;
  }
  const { questions, rules } = quiz.data;
  if (questions.length === 0) {
    return (
      <EmptyState
        icon={CircleHelpIcon}
        title="No quiz questions yet"
        description="Add questions on the Quiz tab of the module."
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <CardDescription>
        Pass mark {rules.passMarkPercent}%.{" "}
        {rules.attemptLimit === null
          ? "Unlimited attempts."
          : `${rules.attemptLimit} attempts allowed.`}
      </CardDescription>
      <QuizPreview questions={questions} />
    </div>
  );
}

import { HydrationBoundary } from "@tanstack/react-query";
import { loadLearningPage } from "@/learn/learning-page-data";
import { QuizResultScreen } from "@/quiz/quiz-result-screen";

export default async function Page({
  params,
}: {
  params: Promise<{ course: string; module: string; attempt: string }>;
}) {
  const { course, module: moduleId, attempt } = await params;
  const { courseId, state } = await loadLearningPage(course);
  return (
    <HydrationBoundary state={state}>
      <QuizResultScreen courseId={courseId} moduleId={moduleId} attemptId={attempt} />
    </HydrationBoundary>
  );
}

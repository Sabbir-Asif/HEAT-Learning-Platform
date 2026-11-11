import { HydrationBoundary } from "@tanstack/react-query";
import { loadLearningPage } from "@/learn/learning-page-data";
import { QuizScreen } from "@/quiz/quiz-screen";

export default async function Page({
  params,
}: {
  params: Promise<{ course: string; module: string }>;
}) {
  const { course, module: moduleId } = await params;
  const { courseId, state } = await loadLearningPage(course);
  return (
    <HydrationBoundary state={state}>
      <QuizScreen courseId={courseId} moduleId={moduleId} />
    </HydrationBoundary>
  );
}

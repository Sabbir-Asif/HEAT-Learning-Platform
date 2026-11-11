import { HydrationBoundary } from "@tanstack/react-query";
import { LessonScreen } from "@/learn/lesson-screen";
import { loadLearningPage } from "@/learn/learning-page-data";

export default async function Page({
  params,
}: {
  params: Promise<{ course: string; module: string }>;
}) {
  const { course, module: moduleId } = await params;
  const { courseId, state } = await loadLearningPage(course, moduleId);
  return (
    <HydrationBoundary state={state}>
      <LessonScreen courseId={courseId} moduleId={moduleId} />
    </HydrationBoundary>
  );
}

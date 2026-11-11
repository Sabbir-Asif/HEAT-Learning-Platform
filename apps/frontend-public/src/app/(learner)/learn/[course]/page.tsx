import { HydrationBoundary } from "@tanstack/react-query";
import { CourseScreen } from "@/learn/course-screen";
import { loadLearningPage } from "@/learn/learning-page-data";

export default async function Page({ params }: { params: Promise<{ course: string }> }) {
  const { course } = await params;
  const { courseId, state } = await loadLearningPage(course);
  return (
    <HydrationBoundary state={state}>
      <CourseScreen courseId={courseId} />
    </HydrationBoundary>
  );
}

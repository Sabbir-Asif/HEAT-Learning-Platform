"use client";

import { useLearningStructure } from "@heat/api-client";
import { CourseHome } from "./course-home";
import { LearnError, LearnLoading } from "./learn-states";

export function CourseScreen({ courseId }: { courseId: string }) {
  const structure = useLearningStructure(courseId);
  if (structure.isPending) return <LearnLoading />;
  if (structure.isError) return <LearnError onRetry={() => void structure.refetch()} />;
  return <CourseHome response={structure.data} />;
}

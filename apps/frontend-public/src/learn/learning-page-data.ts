import "server-only";
import {
  getLearningStructureUrl,
  getLessonContentReadUrl,
  learningStructure,
  lessonContentRead,
} from "@heat/api-client/server";
import type { MeEnrollment } from "@heat/contracts";
import { QueryClient, dehydrate } from "@tanstack/react-query";
import type { DehydratedState } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { cache } from "react";
import { verifySession } from "../auth/session";
import { lessonViewOf } from "./learning-view";

export const requireCourseEnrollment = cache(async (courseSlug: string): Promise<MeEnrollment> => {
  const session = await verifySession();
  const enrollment = session.enrollments.find((candidate) => candidate.courseSlug === courseSlug);
  if (enrollment === undefined) redirect(`/courses/${encodeURIComponent(courseSlug)}`);
  return enrollment;
});

export interface LearningPageData {
  courseId: string;
  state: DehydratedState;
}

export async function loadLearningPage(
  courseSlug: string,
  moduleId?: string,
): Promise<LearningPageData> {
  const { courseId } = await requireCourseEnrollment(courseSlug);
  const structure = await learningStructure(courseId);
  const client = new QueryClient();
  client.setQueryData([getLearningStructureUrl(courseId)], structure);
  if (moduleId !== undefined && lessonViewOf(structure, moduleId).kind === "ready") {
    await client.prefetchQuery({
      queryKey: [getLessonContentReadUrl(courseId, moduleId)],
      queryFn: () => lessonContentRead(courseId, moduleId),
    });
  }
  return { courseId, state: dehydrate(client) };
}

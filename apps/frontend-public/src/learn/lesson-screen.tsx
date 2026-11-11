"use client";

import { isApiError, useLearningStructure, useLessonContentRead } from "@heat/api-client";
import {
  EnrollmentNoticeView,
  LearnError,
  LearnLoading,
  LockedModuleView,
  MissingModuleView,
} from "./learn-states";
import { lessonViewOf, lockedReason } from "./learning-view";
import { LessonPage } from "./lesson-page";
import type { LessonContentState } from "./lesson-page";

export interface LessonScreenProps {
  courseId: string;
  moduleId: string;
}

export function LessonScreen({ courseId, moduleId }: LessonScreenProps) {
  const structure = useLearningStructure(courseId);
  const view = structure.data === undefined ? null : lessonViewOf(structure.data, moduleId);
  const lesson = useLessonContentRead(courseId, moduleId, {
    query: { enabled: view?.kind === "ready" },
  });
  if (structure.isPending) return <LearnLoading />;
  if (structure.isError || view === null) {
    return <LearnError onRetry={() => void structure.refetch()} />;
  }
  if (structure.data === undefined) return <LearnLoading />;
  const { course } = structure.data;
  if (view.kind === "status") {
    return <EnrollmentNoticeView courseTitle={course.title} notice={view.notice} />;
  }
  if (view.kind === "missing") return <MissingModuleView courseSlug={course.slug} />;
  if (view.kind === "locked") {
    return (
      <LockedModuleView
        courseSlug={view.courseSlug}
        moduleTitle={view.module.title}
        reason={view.reason}
      />
    );
  }
  if (lesson.isError && isApiError(lesson.error) && lesson.error.code === "MODULE_LOCKED") {
    return (
      <LockedModuleView
        courseSlug={view.courseSlug}
        moduleTitle={view.module.title}
        reason={lockedReason(view.modules, view.modules.indexOf(view.module))}
      />
    );
  }
  const content: LessonContentState = lesson.isError
    ? { status: "error", onRetry: () => void lesson.refetch() }
    : lesson.data === undefined
      ? { status: "loading" }
      : { status: "ready", content: lesson.data };
  return (
    <LessonPage
      courseSlug={view.courseSlug}
      courseTitle={view.courseTitle}
      module={view.module}
      modules={view.modules}
      lesson={content}
    />
  );
}

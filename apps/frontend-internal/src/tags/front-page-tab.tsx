"use client";

import {
  getAdminFrontPageGetQueryKey,
  isApiError,
  useAdminFrontPageGet,
  useAdminFrontPageReorderCourses,
  useAdminFrontPageReorderModules,
  useModulesList,
  useTagsList,
} from "@heat/api-client";
import { frontpageTagSlug } from "@heat/contracts";
import {
  EmptyState,
  ErrorState,
  FieldDescription,
  SectionHeading,
  Skeleton,
  SortableList,
} from "@heat/ui";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutListIcon } from "lucide-react";
import { useState } from "react";
import { CourseTagsPanel } from "./course-tags-panel";
import { ModuleFrontPageToggle } from "./module-front-page-toggle";
import { frontPageHiddenNote, frontPageReorderFailedMessage } from "./tags-copy";

export function FrontPageTab({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const tags = useTagsList();
  const modules = useModulesList(courseId);
  const frontPage = useAdminFrontPageGet();
  const reorderCourses = useAdminFrontPageReorderCourses();
  const reorderModules = useAdminFrontPageReorderModules();
  const [problem, setProblem] = useState<string | null>(null);
  const queryKey = getAdminFrontPageGetQueryKey();

  if (tags.isPending || frontPage.isPending || modules.isPending) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (tags.isError || frontPage.isError || modules.isError) {
    return (
      <ErrorState
        title="The front page settings could not be loaded"
        onRetry={() => {
          void tags.refetch();
          void frontPage.refetch();
          void modules.refetch();
        }}
      />
    );
  }

  const frontPageTag = tags.data.items.find((tag) => tag.slug === frontpageTagSlug);
  const { courses, modules: tagged } = frontPage.data;

  async function saveCourses(orderedIds: string[]) {
    setProblem(null);
    try {
      const saved = await reorderCourses.mutateAsync({
        data: { previousIds: courses.map((item) => item.id), orderedIds },
      });
      queryClient.setQueryData(queryKey, saved);
    } catch (error) {
      setProblem(frontPageReorderFailedMessage(isApiError(error) ? error.code : undefined));
      await queryClient.invalidateQueries({ queryKey });
    }
  }

  async function saveModules(orderedIds: string[]) {
    setProblem(null);
    try {
      const saved = await reorderModules.mutateAsync({
        data: { previousIds: tagged.map((item) => item.id), orderedIds },
      });
      queryClient.setQueryData(queryKey, saved);
    } catch (error) {
      setProblem(frontPageReorderFailedMessage(isApiError(error) ? error.code : undefined));
      await queryClient.invalidateQueries({ queryKey });
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <CourseTagsPanel courseId={courseId} />
      {frontPageTag !== undefined && modules.data.items.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionHeading>Modules of this course</SectionHeading>
          {modules.data.items.map((item) => (
            <ModuleFrontPageToggle
              key={item.id}
              courseId={courseId}
              moduleId={item.id}
              title={item.title}
              frontPageTagId={frontPageTag.id}
            />
          ))}
        </section>
      ) : null}
      {problem !== null ? <FieldDescription role="alert">{problem}</FieldDescription> : null}
      <section className="flex flex-col gap-3">
        <SectionHeading>Courses on the front page</SectionHeading>
        {courses.length === 0 ? (
          <EmptyState
            icon={LayoutListIcon}
            title="No courses on the front page"
            description="Tag a course with Front page to show it here."
          />
        ) : (
          <SortableList
            aria-label="Courses on the front page in order"
            disabled={reorderCourses.isPending}
            onReorder={(orderedIds) => void saveCourses(orderedIds)}
            items={courses.map((item) => ({
              id: item.id,
              label: item.title,
              content: (
                <div className="flex flex-col gap-1">
                  <span>{item.title}</span>
                  {item.published ? null : (
                    <FieldDescription>{frontPageHiddenNote}</FieldDescription>
                  )}
                </div>
              ),
            }))}
          />
        )}
      </section>
      <section className="flex flex-col gap-3">
        <SectionHeading>Modules on the front page</SectionHeading>
        {tagged.length === 0 ? (
          <EmptyState
            icon={LayoutListIcon}
            title="No modules on the front page"
            description="Tag a module with Front page to show it here."
          />
        ) : (
          <SortableList
            aria-label="Modules on the front page in order"
            disabled={reorderModules.isPending}
            onReorder={(orderedIds) => void saveModules(orderedIds)}
            items={tagged.map((item) => ({
              id: item.id,
              label: `${item.title} (${item.courseTitle})`,
              content: (
                <div className="flex flex-col gap-1">
                  <span>{item.title}</span>
                  <FieldDescription>
                    {item.courseTitle}
                    {item.published ? "" : ` - ${frontPageHiddenNote}`}
                  </FieldDescription>
                </div>
              ),
            }))}
          />
        )}
      </section>
    </div>
  );
}

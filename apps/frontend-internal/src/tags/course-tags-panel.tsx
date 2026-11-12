"use client";

import {
  getAdminFrontPageGetQueryKey,
  getTagAssignmentsCourseTagsQueryKey,
  getTagsListQueryKey,
  useTagAssignmentsCourseTags,
  useTagAssignmentsSetCourseTags,
  useTagsList,
} from "@heat/api-client";
import {
  ErrorState,
  FieldDescription,
  FieldGroup,
  FieldLegend,
  FieldSet,
  Skeleton,
} from "@heat/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { TagCheckbox } from "./tag-checkbox";
import { tagsSaveFailedMessage } from "./tags-copy";

export function CourseTagsPanel({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const tags = useTagsList();
  const assigned = useTagAssignmentsCourseTags(courseId);
  const save = useTagAssignmentsSetCourseTags();
  const [problem, setProblem] = useState<string | null>(null);

  if (tags.isPending || assigned.isPending) return <Skeleton className="h-24 w-full" />;
  if (tags.isError || assigned.isError) {
    return (
      <ErrorState
        title="The tags could not be loaded"
        onRetry={() => {
          void tags.refetch();
          void assigned.refetch();
        }}
      />
    );
  }

  const selected = assigned.data.items.map((item) => item.id);

  async function toggle(tagId: string, next: boolean) {
    setProblem(null);
    const tagIds = next ? [...selected, tagId] : selected.filter((id) => id !== tagId);
    try {
      await save.mutateAsync({ id: courseId, data: { tagIds } });
    } catch {
      setProblem(tagsSaveFailedMessage);
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getTagAssignmentsCourseTagsQueryKey(courseId) }),
      queryClient.invalidateQueries({ queryKey: getAdminFrontPageGetQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getTagsListQueryKey() }),
    ]);
  }

  return (
    <FieldSet>
      <FieldLegend>Course tags</FieldLegend>
      <FieldDescription>
        Tags can be changed at any time, including after students enroll.
      </FieldDescription>
      {problem !== null ? <FieldDescription role="alert">{problem}</FieldDescription> : null}
      <FieldGroup>
        {tags.data.items.map((tag) => (
          <TagCheckbox
            key={tag.id}
            label={tag.name}
            checked={selected.includes(tag.id)}
            disabled={save.isPending}
            onChange={(next) => void toggle(tag.id, next)}
          />
        ))}
      </FieldGroup>
    </FieldSet>
  );
}

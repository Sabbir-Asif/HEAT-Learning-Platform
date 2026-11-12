"use client";

import {
  getAdminFrontPageGetQueryKey,
  getTagAssignmentsModuleTagsQueryKey,
  getTagsListQueryKey,
  useTagAssignmentsModuleTags,
  useTagAssignmentsSetModuleTags,
} from "@heat/api-client";
import { FieldDescription, Skeleton } from "@heat/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { TagCheckbox } from "./tag-checkbox";
import { tagsSaveFailedMessage } from "./tags-copy";

type ModuleFrontPageToggleProps = {
  courseId: string;
  moduleId: string;
  title: string;
  frontPageTagId: string;
};

export function ModuleFrontPageToggle({
  courseId,
  moduleId,
  title,
  frontPageTagId,
}: ModuleFrontPageToggleProps) {
  const queryClient = useQueryClient();
  const assigned = useTagAssignmentsModuleTags(courseId, moduleId);
  const save = useTagAssignmentsSetModuleTags();
  const [problem, setProblem] = useState<string | null>(null);

  if (assigned.isPending) return <Skeleton className="h-6 w-64" />;
  if (assigned.isError) {
    return (
      <FieldDescription role="alert">The tags of {title} could not be loaded.</FieldDescription>
    );
  }

  const selected = assigned.data.items.map((item) => item.id);

  async function toggle(next: boolean) {
    setProblem(null);
    const tagIds = next
      ? [...selected, frontPageTagId]
      : selected.filter((id) => id !== frontPageTagId);
    try {
      await save.mutateAsync({ id: courseId, moduleId, data: { tagIds } });
    } catch {
      setProblem(tagsSaveFailedMessage);
    }
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: getTagAssignmentsModuleTagsQueryKey(courseId, moduleId),
      }),
      queryClient.invalidateQueries({ queryKey: getAdminFrontPageGetQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getTagsListQueryKey() }),
    ]);
  }

  return (
    <div className="flex flex-col gap-1">
      <TagCheckbox
        label={`Show ${title} on the front page`}
        checked={selected.includes(frontPageTagId)}
        disabled={save.isPending}
        onChange={(next) => void toggle(next)}
      />
      {problem !== null ? <FieldDescription role="alert">{problem}</FieldDescription> : null}
    </div>
  );
}

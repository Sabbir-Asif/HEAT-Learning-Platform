"use client";

import {
  getTagAssignmentsCourseTagsQueryKey,
  useTagAssignmentsCourseTags,
  useTagAssignmentsSetCourseTags,
  useTagsList,
} from "@heat/api-client";
import { frontpageTagSlug } from "@heat/contracts";
import { Card, CardContent, Checkbox, FieldDescription, Skeleton } from "@heat/ui";
import { useQueryClient } from "@tanstack/react-query";
import { HouseIcon } from "lucide-react";
import { useId, useState } from "react";

export function HomePageCard({ courseId, published }: { courseId: string; published: boolean }) {
  const queryClient = useQueryClient();
  const tags = useTagsList();
  const assigned = useTagAssignmentsCourseTags(courseId);
  const setTags = useTagAssignmentsSetCourseTags();
  const [problem, setProblem] = useState<string | null>(null);
  const checkboxId = useId();
  const frontpage = tags.data?.items.find((tag) => tag.slug === frontpageTagSlug);
  const current = assigned.data?.items ?? [];
  const shown = current.some((tag) => tag.slug === frontpageTagSlug);

  async function change(next: boolean) {
    if (frontpage === undefined) return;
    setProblem(null);
    const others = current.filter((tag) => tag.slug !== frontpageTagSlug).map((tag) => tag.id);
    try {
      await setTags.mutateAsync({
        id: courseId,
        data: { tagIds: next ? [...others, frontpage.id] : others },
      });
      await queryClient.invalidateQueries({
        queryKey: getTagAssignmentsCourseTagsQueryKey(courseId),
      });
    } catch {
      setProblem("The home page setting could not be saved. Try again.");
    }
  }

  const loading = tags.isPending || assigned.isPending;
  const unavailable = tags.isError || assigned.isError || (!loading && frontpage === undefined);

  return (
    <Card>
      <CardContent className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="bg-accent text-accent-foreground grid size-11 shrink-0 place-items-center rounded-xl"
        >
          <HouseIcon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {loading ? (
            <Skeleton className="h-5 w-56" />
          ) : unavailable ? (
            <FieldDescription role="alert">
              The home page setting could not be loaded. Reload the page to try again.
            </FieldDescription>
          ) : (
            <>
              <label htmlFor={checkboxId} className="flex items-center gap-3 font-medium">
                <Checkbox
                  id={checkboxId}
                  checked={shown}
                  disabled={setTags.isPending}
                  onCheckedChange={(next) => void change(next)}
                />
                Show this course on the public home page
              </label>
              <FieldDescription>
                {published
                  ? shown
                    ? "Visitors see this course in the Courses section of the home page."
                    : "This course is published but hidden from the home page. Tick the box to feature it."
                  : "The course appears on the home page once it is published."}
              </FieldDescription>
            </>
          )}
          {problem !== null ? <FieldDescription role="alert">{problem}</FieldDescription> : null}
        </div>
      </CardContent>
    </Card>
  );
}

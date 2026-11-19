"use client";

import {
  getCoursesGetQueryOptions,
  getCoursesListQueryKey,
  isApiError,
  useCoursesList,
  useCoursesRemove,
} from "@heat/api-client";
import type { CourseListResponseDtoItemsItem } from "@heat/api-client";
import { courseSortFields } from "@heat/contracts";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FieldDescription,
  PageHeader,
  Skeleton,
} from "@heat/ui";
import {
  FilterBar,
  FilterSelect,
  Pagination,
  SearchInput,
  useClampedPage,
  useTableUrlState,
} from "@heat/ui/data";
import { filterIcon } from "../filters/filter-icon";
import { ShellContent } from "@heat/ui/shell";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpenIcon, PencilIcon, PlusIcon, SearchXIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CourseCard } from "./course-card";
import { CourseFormSheet } from "./course-form-sheet";
import { courseDeleteBlockedMessage, courseDeleteFailedMessage } from "./courses-copy";
import {
  courseStatusFilterKey,
  courseStatusFilterOptions,
  courseStatusFromUrl,
  courseStatusItems,
} from "./courses-status";

type CourseRow = CourseListResponseDtoItemsItem;

const gridClass = "grid gap-6 sm:grid-cols-2 xl:grid-cols-3";

const sortable = ["title", "createdAt", "updatedAt"] as const;
const sortValues: readonly string[] = courseSortFields;

export function CoursesView() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const url = useTableUrlState({
    sortable,
    filters: [courseStatusFilterKey],
    filterOptions: courseStatusFilterOptions,
  });
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<{ id: string; message: string } | null>(null);
  const sortValue = url.sort ? `${url.sort.desc ? "-" : ""}${url.sort.id}` : undefined;
  const status = courseStatusFromUrl(url.filters[courseStatusFilterKey]);
  const list = useCoursesList({
    status,
    page: url.page,
    pageSize: url.pageSize,
    ...(sortValue !== undefined && sortValues.includes(sortValue)
      ? { sort: sortValue as (typeof courseSortFields)[number] }
      : {}),
    ...(url.query ? { q: url.query } : {}),
  });
  const remove = useCoursesRemove();
  const total = list.data?.total ?? 0;
  const page = useClampedPage(url.page, url.pageSize, total, url.setPage);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getCoursesListQueryKey().slice(0, 1) });

  function actions(row: CourseRow) {
    return (
      <>
        <Button variant="ghost" size="sm" render={<Link href={`/courses/${row.id}`} />}>
          <PencilIcon data-icon="inline-start" />
          Edit
        </Button>
        <ConfirmDialog
          trigger={
            <Button variant="ghostDestructive" size="sm">
              <Trash2Icon data-icon="inline-start" />
              Delete
            </Button>
          }
          title="Delete this course?"
          itemName={row.title}
          confirmationName={row.title}
          description="A draft course without enrollments is removed. A published course or one with enrollments cannot be deleted."
          confirmLabel="Delete course"
          destructive
          errorMessage={
            blocked?.id === row.id ? blocked.message : courseDeleteFailedMessage(row.title)
          }
          onConfirm={async () => {
            setNotice(null);
            setBlocked(null);
            try {
              await remove.mutateAsync({ id: row.id });
            } catch (error) {
              if (isApiError(error) && error.code === "COURSE_HAS_ENROLLMENTS") {
                const current = await queryClient
                  .fetchQuery({ ...getCoursesGetQueryOptions(row.id), staleTime: 0 })
                  .catch(() => row);
                setBlocked({
                  id: row.id,
                  message: courseDeleteBlockedMessage(row.title, current.enrollmentCount),
                });
                void refresh();
              }
              throw error;
            }
            await refresh();
            setNotice(`${row.title} was deleted.`);
          }}
        />
      </>
    );
  }

  return (
    <ShellContent>
      <PageHeader
        title="Courses"
        description="Create courses, build their modules and publish them to learners."
        action={
          <Button
            onClick={() => {
              setNotice(null);
              setCreating(true);
            }}
          >
            <PlusIcon data-icon="inline-start" />
            Add course
          </Button>
        }
      />
      {notice !== null ? <FieldDescription role="status">{notice}</FieldDescription> : null}
      <FilterBar
        activeCount={url.activeFilterCount}
        onClear={url.clearFilters}
        search={
          <SearchInput
            label="Search courses"
            placeholder="Search by title or slug"
            value={url.query}
            onValueChange={url.setQuery}
          />
        }
      >
        <FilterSelect
          label="Status"
          icon={filterIcon("Status")}
          items={courseStatusItems}
          value={status}
          onValueChange={(value) =>
            url.setFilter(courseStatusFilterKey, value === "all" ? null : value)
          }
        />
      </FilterBar>
      {list.isError ? (
        <ErrorState title="The courses could not be loaded" onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <div role="status" aria-label="Loading courses" className={gridClass}>
          {[0, 1, 2].map((slot) => (
            <Skeleton key={slot} className="h-80 w-full rounded-xl" />
          ))}
        </div>
      ) : list.data.items.length === 0 ? (
        url.activeFilterCount > 0 || url.query !== "" ? (
          <EmptyState
            icon={SearchXIcon}
            title="No courses match"
            description="Try a different search or clear the filters."
            action={
              <Button variant="outline" onClick={url.clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={BookOpenIcon}
            title="No courses yet"
            description="Add a course to start building its modules."
          />
        )
      ) : (
        <>
          <ul className={gridClass} aria-label="Courses">
            {list.data.items.map((row, index) => (
              <li key={row.id} className="flex *:w-full">
                <CourseCard course={row} priority={index < 3} actions={actions(row)} />
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            pageSize={url.pageSize}
            total={total}
            onPageChange={url.setPage}
            onPageSizeChange={url.setPageSize}
          />
        </>
      )}
      <CourseFormSheet
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={async (course) => {
          await refresh();
          router.push(`/courses/${course.id}`);
        }}
      />
    </ShellContent>
  );
}

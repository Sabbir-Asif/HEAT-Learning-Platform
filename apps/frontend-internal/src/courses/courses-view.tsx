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
  CellPrimary,
  ConfirmDialog,
  Field,
  FieldDescription,
  FieldLabel,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
} from "@heat/ui";
import { DataTable, FilterBar, SearchInput, useClampedPage, useTableUrlState } from "@heat/ui/data";
import type { DataTableColumn } from "@heat/ui/data";
import { ShellContent } from "@heat/ui/shell";
import { useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatDhakaTime } from "../admins/admin-copy";
import { CourseFormSheet } from "./course-form-sheet";
import { courseDeleteBlockedMessage, courseDeleteFailedMessage } from "./courses-copy";
import {
  courseStatusFilterKey,
  courseStatusFilterOptions,
  courseStatusFromUrl,
  courseStatusItems,
} from "./courses-status";

type CourseRow = CourseListResponseDtoItemsItem;

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

  const columns = useMemo<DataTableColumn<CourseRow>[]>(
    () => [
      {
        id: "title",
        header: "Course",
        cell: (row) => (
          <CellPrimary
            title={<Link href={`/courses/${row.id}`}>{row.title}</Link>}
            description={row.slug}
          />
        ),
        sortable: true,
      },
      {
        id: "status",
        header: "Status",
        cell: (row) => <StatusBadge kind="course" status={row.status} />,
      },
      {
        id: "enrollments",
        header: "Enrollments",
        cell: (row) => String(row.enrollmentCount),
      },
      {
        id: "updatedAt",
        header: "Updated",
        cell: (row) => formatDhakaTime(row.updatedAt),
        sortable: true,
      },
    ],
    [],
  );

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
        <Field>
          <FieldLabel id="course-filter-status">Status</FieldLabel>
          <Select
            items={courseStatusItems}
            value={status}
            onValueChange={(value) =>
              url.setFilter(courseStatusFilterKey, value === "all" ? null : value)
            }
          >
            <SelectTrigger aria-labelledby="course-filter-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {courseStatusItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FilterBar>
      <DataTable
        label="Courses"
        columns={columns}
        rows={list.data?.items ?? []}
        getRowId={(row) => row.id}
        total={total}
        page={page}
        pageSize={url.pageSize}
        sort={url.sort}
        onToggleSort={url.toggleSort}
        onSortChange={url.setSort}
        onPageChange={url.setPage}
        onPageSizeChange={url.setPageSize}
        status={list.isError ? "error" : list.isPending ? "loading" : "ready"}
        fetching={list.isFetching && !list.isPending}
        onRetry={() => void list.refetch()}
        filtersActive={url.activeFilterCount > 0}
        onClearFilters={url.clearFilters}
        emptyTitle="No courses yet"
        emptyDescription="Add a course to start building its modules."
        actions={actions}
      />
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

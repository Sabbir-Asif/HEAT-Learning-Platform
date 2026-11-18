"use client";

import {
  getStudentExportDownloadUrl,
  getStudentListListQueryKey,
  useCoursesList,
  useDepartmentsList,
  useFacultiesList,
  useStudentListList,
  useUniversitiesList,
} from "@heat/api-client";
import type { StudentListListParams, StudentListResponseDtoItemsItem } from "@heat/api-client";
import { academicSessionSchema, enrollmentStatuses } from "@heat/contracts";
import { Button, FieldDescription, PageHeader, StatusBadge } from "@heat/ui";
import {
  DataTable,
  FilterBar,
  FilterInput,
  FilterSelect,
  SearchInput,
  useClampedPage,
  useTableUrlState,
} from "@heat/ui/data";
import type { DataTableColumn } from "@heat/ui/data";
import { filterIcon } from "../filters/filter-icon";
import { ShellContent } from "@heat/ui/shell";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { DownloadIcon, RotateCcwIcon, UserMinusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { exportButtonLabel, exportDescription } from "./students-copy";
import { StudentRemovalSheet } from "./student-removal-sheet";
import type { StudentRemovalTarget } from "./student-removal-sheet";
import {
  canReinstateStudent,
  canRemoveStudent,
  removalNotice,
  studentBadgeStatus,
  studentSortValue,
  studentSortable,
  studentStatusFilterKey,
  studentStatusFilterOptions,
  studentProfileHref,
  studentStatusLabels,
} from "./student-copy";

type StudentRow = StudentListResponseDtoItemsItem;

const filterKeys = [
  "course",
  "university",
  "faculty",
  "department",
  "session",
  studentStatusFilterKey,
] as const;
const optionLimit = 50;
const all = "all";

export function StudentsView() {
  const queryClient = useQueryClient();
  const [removalTarget, setRemovalTarget] = useState<StudentRemovalTarget>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const url = useTableUrlState({
    sortable: studentSortable,
    filters: filterKeys,
    filterOptions: studentStatusFilterOptions,
  });
  const filter = (key: (typeof filterKeys)[number]): string => url.filters[key] ?? "";
  const course = filter("course");
  const university = filter("university");
  const faculty = filter("faculty");
  const department = filter("department");
  const session = filter("session");
  const status = filter(studentStatusFilterKey);
  const sessionValid = session === "" || academicSessionSchema.safeParse(session).success;

  const filters = {
    ...(course ? { courseId: course } : {}),
    ...(university ? { universityId: university } : {}),
    ...(university && faculty ? { facultyId: faculty } : {}),
    ...(university && faculty && department ? { departmentId: department } : {}),
    ...(session && sessionValid ? { session } : {}),
    ...(status ? { status: status as (typeof enrollmentStatuses)[number] } : {}),
    ...(url.query ? { q: url.query } : {}),
  };
  const params: StudentListListParams = {
    page: url.page,
    pageSize: url.pageSize,
    sort: studentSortValue(url.sort),
    ...filters,
  };
  const exportUrl = getStudentExportDownloadUrl(filters);
  const list = useStudentListList(params);
  const courses = useCoursesList({ page: 1, pageSize: optionLimit, status: "published" });
  const universities = useUniversitiesList({
    page: 1,
    pageSize: optionLimit,
    sort: "name",
    status: "all",
  });
  const faculties = useFacultiesList(
    { page: 1, pageSize: optionLimit, sort: "name", status: "all", universityId: university },
    { query: { enabled: Boolean(university) } },
  );
  const departments = useDepartmentsList(
    {
      page: 1,
      pageSize: optionLimit,
      sort: "name",
      status: "all",
      universityId: university,
      facultyId: faculty,
    },
    { query: { enabled: Boolean(university && faculty) } },
  );
  const total = list.data?.total ?? 0;
  const page = useClampedPage(url.page, url.pageSize, total, url.setPage);
  const items = list.data?.items;
  const rows = useMemo(() => items ?? [], [items]);

  const options = (
    placeholder: string,
    entries: ReadonlyArray<{ id: string; name?: string; title?: string }> | undefined,
  ) => [
    { value: all, label: placeholder },
    ...(entries ?? []).map((entry) => ({
      value: entry.id,
      label: entry.title ?? entry.name ?? entry.id,
    })),
  ];
  const statusItems = [
    { value: all, label: "All statuses" },
    ...enrollmentStatuses.map((value) => ({ value, label: studentStatusLabels[value] })),
  ];

  const columns = useMemo<DataTableColumn<StudentRow>[]>(
    () => [
      {
        id: "name",
        header: "Student",
        sortable: true,
        cell: (row) => (
          <div className="flex flex-col">
            <Button
              variant="link"
              className="h-auto justify-start p-0"
              render={<Link href={studentProfileHref(row.student.userId)} />}
            >
              {row.student.name}
            </Button>
            <FieldDescription>{row.student.email}</FieldDescription>
          </div>
        ),
      },
      { id: "course", header: "Course", cell: (row) => row.course.title },
      { id: "university", header: "University", cell: (row) => row.university.name },
      { id: "faculty", header: "Faculty", cell: (row) => row.faculty.name },
      { id: "department", header: "Department", cell: (row) => row.department.name },
      { id: "session", header: "Session", cell: (row) => row.session },
      {
        id: "status",
        header: "Status",
        cell: (row) => <StatusBadge kind="enrollment" status={studentBadgeStatus(row.status)} />,
      },
    ],
    [],
  );

  const selectFilter = (
    id: string,
    label: string,
    entries: Array<{ value: string; label: string }>,
    value: string,
    onChange: (next: string | null) => void,
    disabled = false,
    truncated = false,
  ) => (
    <FilterSelect
      label={label}
      icon={filterIcon(label)}
      items={entries}
      value={value || all}
      defaultValue={all}
      disabled={disabled}
      note={
        truncated ? `Showing the first ${optionLimit}. Narrow with the other filters.` : undefined
      }
      onValueChange={(next) => onChange(next === all ? null : next)}
    />
  );

  return (
    <ShellContent>
      <PageHeader
        title="Students"
        action={
          <Button nativeButton={false} render={<a href={exportUrl} download="students.csv" />}>
            <DownloadIcon data-icon="inline-start" />
            {exportButtonLabel}
          </Button>
        }
      />
      <FieldDescription>{exportDescription}</FieldDescription>
      {notice !== null ? <FieldDescription role="status">{notice}</FieldDescription> : null}
      <FilterBar
        activeCount={url.activeFilterCount}
        onClear={url.clearFilters}
        search={
          <SearchInput
            label="Search students"
            placeholder="Search by name or email"
            value={url.query}
            onValueChange={url.setQuery}
          />
        }
      >
        {selectFilter(
          "course",
          "Course",
          options("All courses", courses.data?.items),
          course,
          (next) => url.setFilter("course", next),
          false,
          (courses.data?.total ?? 0) > optionLimit,
        )}
        {selectFilter(
          "university",
          "University",
          options("All universities", universities.data?.items),
          university,
          (next) => url.setFilters({ university: next, faculty: null, department: null }),
          false,
          (universities.data?.total ?? 0) > optionLimit,
        )}
        {selectFilter(
          "faculty",
          "Faculty",
          options("All faculties", faculties.data?.items),
          faculty,
          (next) => url.setFilters({ faculty: next, department: null }),
          !university,
          (faculties.data?.total ?? 0) > optionLimit,
        )}
        {selectFilter(
          "department",
          "Department",
          options("All departments", departments.data?.items),
          department,
          (next) => url.setFilter("department", next),
          !university || !faculty,
          (departments.data?.total ?? 0) > optionLimit,
        )}
        <FilterInput
          label="Session"
          icon={filterIcon("Session")}
          key={session}
          defaultValue={session}
          placeholder="2020-21"
          error={
            sessionValid
              ? undefined
              : "Use the format 2020-21, where the second part is the next year."
          }
          onBlur={(event) => {
            const next = event.target.value.trim();
            if (next !== session) url.setFilter("session", next);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        {selectFilter(studentStatusFilterKey, "Status", statusItems, status, (next) =>
          url.setFilter(studentStatusFilterKey, next),
        )}
      </FilterBar>
      <DataTable
        label="Students"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        total={total}
        page={page}
        pageSize={url.pageSize}
        sort={url.sort ?? { id: "name", desc: false }}
        onToggleSort={url.toggleSort}
        onSortChange={url.setSort}
        onPageChange={url.setPage}
        onPageSizeChange={url.setPageSize}
        status={list.isError ? "error" : list.isPending ? "loading" : "ready"}
        fetching={list.isFetching && !list.isPending}
        onRetry={() => void list.refetch()}
        filtersActive={url.activeFilterCount > 0 || url.query !== ""}
        onClearFilters={url.clearFilters}
        emptyTitle="No students found"
        emptyDescription="Students appear here after they request enrollment."
        actions={(row) =>
          canRemoveStudent(row.status) ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setNotice(null);
                setRemovalTarget({ action: "remove", id: row.id, name: row.student.name });
              }}
            >
              <UserMinusIcon data-icon="inline-start" />
              Remove
            </Button>
          ) : canReinstateStudent(row.status) ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setNotice(null);
                setRemovalTarget({ action: "reinstate", id: row.id, name: row.student.name });
              }}
            >
              <RotateCcwIcon data-icon="inline-start" />
              Reinstate
            </Button>
          ) : null
        }
      />
      <StudentRemovalSheet
        target={removalTarget}
        onClose={() => setRemovalTarget(null)}
        onFinished={(action, name) => {
          setNotice(removalNotice(action, name));
          void queryClient.invalidateQueries({
            queryKey: getStudentListListQueryKey().slice(0, 1),
          });
        }}
      />
    </ShellContent>
  );
}

"use client";

import {
  getEnrollmentApprovalListPendingQueryKey,
  useCoursesList,
  useDepartmentsList,
  useEnrollmentApprovalListPending,
  useFacultiesList,
  useUniversitiesList,
} from "@heat/api-client";
import type {
  ApprovalQueueResponseDtoItemsItem,
  EnrollmentApprovalListPendingParams,
} from "@heat/api-client";
import { academicSessionSchema } from "@heat/contracts";
import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@heat/ui";
import { DataTable, FilterBar, useClampedPage, useTableUrlState } from "@heat/ui/data";
import type { DataTableColumn } from "@heat/ui/data";
import { ShellContent } from "@heat/ui/shell";
import { useQueryClient } from "@tanstack/react-query";
import { CheckIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDhakaTime } from "../admins/admin-copy";
import {
  approvalSummaryText,
  approveLabel,
  queueSortValue,
  rejectLabel,
  rejectionSummaryText,
  selectionLabel,
} from "./approval-copy";
import { ApproveSheet } from "./approve-sheet";
import type { ApproveTarget } from "./approve-sheet";
import { RejectSheet } from "./reject-sheet";
import type { RejectTarget } from "./reject-sheet";

type QueueRow = ApprovalQueueResponseDtoItemsItem;

const filterKeys = [
  "course",
  "university",
  "faculty",
  "department",
  "session",
  "from",
  "to",
] as const;
const sortable = ["requestedAt"] as const;
const optionLimit = 50;
const all = "all";

export function ApprovalQueueView() {
  const queryClient = useQueryClient();
  const url = useTableUrlState({ sortable, filters: filterKeys });
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [target, setTarget] = useState<ApproveTarget>(null);
  const [rejectTarget, setRejectTarget] = useState<RejectTarget>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const labels = useRef(new Map<string, string>());
  const filter = (key: (typeof filterKeys)[number]): string => url.filters[key] ?? "";
  const course = filter("course");
  const university = filter("university");
  const faculty = filter("faculty");
  const department = filter("department");
  const session = filter("session");
  const from = filter("from");
  const to = filter("to");
  const rangeInvalid = Boolean(from && to && to < from);
  const sessionValid = session === "" || academicSessionSchema.safeParse(session).success;

  const params: EnrollmentApprovalListPendingParams = {
    page: url.page,
    pageSize: url.pageSize,
    sort: queueSortValue(url.sort),
    ...(course ? { courseId: course } : {}),
    ...(university ? { universityId: university } : {}),
    ...(university && faculty ? { facultyId: faculty } : {}),
    ...(university && faculty && department ? { departmentId: department } : {}),
    ...(session && sessionValid ? { session } : {}),
    ...(from ? { submittedFrom: from } : {}),
    ...(to ? { submittedTo: to } : {}),
  };
  const list = useEnrollmentApprovalListPending(params, {
    query: { enabled: !rangeInvalid },
  });
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
  useEffect(() => {
    for (const row of rows)
      labels.current.set(row.id, `${row.student.name} (${row.student.email})`);
  }, [rows]);

  const options = (
    placeholder: string,
    items: ReadonlyArray<{ id: string; name?: string; title?: string }> | undefined,
  ) => [
    { value: all, label: placeholder },
    ...(items ?? []).map((item) => ({ value: item.id, label: item.title ?? item.name ?? item.id })),
  ];
  const courseItems = options("All courses", courses.data?.items);
  const universityItems = options("All universities", universities.data?.items);
  const facultyItems = options("All faculties", faculties.data?.items);
  const departmentItems = options("All departments", departments.data?.items);

  const columns = useMemo<DataTableColumn<QueueRow>[]>(
    () => [
      {
        id: "student",
        header: "Student",
        cell: (row) => (
          <div className="flex flex-col">
            <strong>{row.student.name}</strong>
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
        id: "requestedAt",
        header: "Submitted",
        cell: (row) => formatDhakaTime(row.requestedAt),
        sortable: true,
      },
    ],
    [],
  );

  const selectFilter = (
    id: string,
    label: string,
    items: Array<{ value: string; label: string }>,
    value: string,
    onChange: (next: string | null) => void,
    disabled = false,
    truncated = false,
  ) => (
    <Field>
      <FieldLabel id={`approval-filter-${id}`}>{label}</FieldLabel>
      <Select
        items={items}
        value={value || all}
        disabled={disabled}
        onValueChange={(next) => onChange(next === all ? null : next)}
      >
        <SelectTrigger aria-labelledby={`approval-filter-${id}`} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {truncated ? (
        <FieldDescription>{`Showing the first ${optionLimit}. Narrow with the other filters.`}</FieldDescription>
      ) : null}
    </Field>
  );

  const dateFilter = (key: "from" | "to", label: string) => (
    <Field>
      <FieldLabel htmlFor={`approval-${key}`}>{label}</FieldLabel>
      <Input
        id={`approval-${key}`}
        type="date"
        {...(key === "from" && to ? { max: to } : {})}
        {...(key === "to" && from ? { min: from } : {})}
        aria-invalid={key === "to" && rangeInvalid ? true : undefined}
        value={url.filters[key]}
        onChange={(event) => url.setFilter(key, event.target.value)}
      />
      {key === "to" && rangeInvalid ? (
        <FieldError>The end date must not be before the start date.</FieldError>
      ) : null}
    </Field>
  );

  function openApprove(ids: string[]) {
    setNotice(null);
    setTarget({
      ids,
      labels: Object.fromEntries(ids.map((id) => [id, labels.current.get(id) ?? id])),
    });
  }

  function openReject(ids: string[]) {
    setNotice(null);
    setRejectTarget({
      ids,
      labels: Object.fromEntries(ids.map((id) => [id, labels.current.get(id) ?? id])),
    });
  }

  const selectedCount = selected.size;

  return (
    <ShellContent>
      <PageHeader
        title="Enrollments"
        action={
          selectedCount > 0 ? (
            <>
              <Button variant="outline" onClick={() => openReject([...selected])}>
                <XIcon data-icon="inline-start" />
                {rejectLabel(selectedCount)}
              </Button>
              <Button onClick={() => openApprove([...selected])}>
                <CheckIcon data-icon="inline-start" />
                {approveLabel(selectedCount)}
              </Button>
            </>
          ) : undefined
        }
      />
      {selectedCount > 0 ? (
        <FieldDescription role="status">
          {selectionLabel(selectedCount)}.{" "}
          <Button variant="link" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
        </FieldDescription>
      ) : null}
      {notice !== null ? <FieldDescription role="status">{notice}</FieldDescription> : null}
      <FilterBar activeCount={url.activeFilterCount} onClear={url.clearFilters}>
        {selectFilter(
          "course",
          "Course",
          courseItems,
          course,
          (next) => url.setFilter("course", next),
          false,
          (courses.data?.total ?? 0) > optionLimit,
        )}
        {selectFilter(
          "university",
          "University",
          universityItems,
          university,
          (next) => url.setFilters({ university: next, faculty: null, department: null }),
          false,
          (universities.data?.total ?? 0) > optionLimit,
        )}
        {selectFilter(
          "faculty",
          "Faculty",
          facultyItems,
          faculty,
          (next) => url.setFilters({ faculty: next, department: null }),
          !university,
          (faculties.data?.total ?? 0) > optionLimit,
        )}
        {selectFilter(
          "department",
          "Department",
          departmentItems,
          department,
          (next) => url.setFilter("department", next),
          !university || !faculty,
          (departments.data?.total ?? 0) > optionLimit,
        )}
        <Field>
          <FieldLabel htmlFor="approval-session">Session</FieldLabel>
          <Input
            id="approval-session"
            key={session}
            defaultValue={session}
            placeholder="2020-21"
            aria-invalid={sessionValid ? undefined : true}
            onBlur={(event) => {
              const next = event.target.value.trim();
              if (next !== session) url.setFilter("session", next);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
          {sessionValid ? null : (
            <FieldError>Use the format 2020-21, where the second part is the next year.</FieldError>
          )}
        </Field>
        {dateFilter("from", "Submitted from")}
        {dateFilter("to", "Submitted to")}
      </FilterBar>
      <DataTable
        label="Pending enrollment requests"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        total={total}
        page={page}
        pageSize={url.pageSize}
        sort={url.sort ?? { id: "requestedAt", desc: false }}
        onToggleSort={url.toggleSort}
        onSortChange={url.setSort}
        onPageChange={url.setPage}
        onPageSizeChange={url.setPageSize}
        status={list.isError ? "error" : list.isPending ? "loading" : "ready"}
        fetching={list.isFetching && !list.isPending}
        onRetry={() => void list.refetch()}
        filtersActive={url.activeFilterCount > 0}
        onClearFilters={url.clearFilters}
        emptyTitle="No requests waiting for approval"
        emptyDescription="Requests appear here after the student verifies their email."
        selection={{
          selectedIds: selected,
          onSelectedChange: setSelected,
          rowLabel: (row) => `Select ${row.student.name}`,
        }}
        actions={(row) => (
          <>
            <Button size="sm" variant="outline" onClick={() => openReject([row.id])}>
              <XIcon data-icon="inline-start" />
              Reject
            </Button>
            <Button size="sm" onClick={() => openApprove([row.id])}>
              <CheckIcon data-icon="inline-start" />
              Approve
            </Button>
          </>
        )}
      />
      <ApproveSheet
        target={target}
        onClose={() => setTarget(null)}
        onFinished={(summary) => {
          setSelected((current) => {
            const next = new Set(current);
            for (const id of summary.succeeded) next.delete(id);
            return next;
          });
          setNotice(approvalSummaryText(summary.succeeded.length, summary.failed.length));
          void queryClient.invalidateQueries({
            queryKey: getEnrollmentApprovalListPendingQueryKey().slice(0, 1),
          });
        }}
      />
      <RejectSheet
        target={rejectTarget}
        onClose={() => setRejectTarget(null)}
        onFinished={(summary) => {
          setSelected((current) => {
            const next = new Set(current);
            for (const id of summary.succeeded) next.delete(id);
            return next;
          });
          setNotice(rejectionSummaryText(summary.succeeded.length, summary.failed.length));
          void queryClient.invalidateQueries({
            queryKey: getEnrollmentApprovalListPendingQueryKey().slice(0, 1),
          });
        }}
      />
    </ShellContent>
  );
}

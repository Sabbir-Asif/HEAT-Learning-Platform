"use client";

import {
  getStudentExportDownloadUrl,
  useCoursesList,
  useDepartmentsList,
  useFacultiesList,
  useUniversitiesList,
} from "@heat/api-client";
import type { StudentExportDownloadParams } from "@heat/api-client";
import { academicSessionSchema, studentEnrollmentStatusSchema } from "@heat/contracts";
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
import { FilterBar, useTableUrlState } from "@heat/ui/data";
import { ShellContent } from "@heat/ui/shell";
import { DownloadIcon } from "lucide-react";
import { exportButtonLabel, exportDescription, studentStatusOptions } from "./students-copy";

const filterKeys = ["course", "university", "faculty", "department", "session", "status"] as const;
const optionLimit = 50;
const all = "all";

export function StudentsView() {
  const url = useTableUrlState({ sortable: [], filters: filterKeys });
  const filter = (key: (typeof filterKeys)[number]): string => url.filters[key] ?? "";
  const course = filter("course");
  const university = filter("university");
  const faculty = filter("faculty");
  const department = filter("department");
  const session = filter("session");
  const status = filter("status");
  const sessionValid = session === "" || academicSessionSchema.safeParse(session).success;
  const statusValid = status === "" || studentEnrollmentStatusSchema.safeParse(status).success;
  const search = url.query.trim();

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

  const options = (
    placeholder: string,
    items: ReadonlyArray<{ id: string; name?: string; title?: string }> | undefined,
  ) => [
    { value: all, label: placeholder },
    ...(items ?? []).map((item) => ({ value: item.id, label: item.title ?? item.name ?? item.id })),
  ];

  const params: StudentExportDownloadParams = {
    ...(course ? { courseId: course } : {}),
    ...(university ? { universityId: university } : {}),
    ...(university && faculty ? { facultyId: faculty } : {}),
    ...(university && faculty && department ? { departmentId: department } : {}),
    ...(session && sessionValid ? { session } : {}),
    ...(status && statusValid ? { status: studentEnrollmentStatusSchema.parse(status) } : {}),
    ...(search ? { search } : {}),
  };
  const exportUrl = getStudentExportDownloadUrl(params);

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
      <FieldLabel id={`students-filter-${id}`}>{label}</FieldLabel>
      <Select
        items={items}
        value={value || all}
        disabled={disabled}
        onValueChange={(next) => onChange(next === all ? null : next)}
      >
        <SelectTrigger aria-labelledby={`students-filter-${id}`} className="w-full">
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
      <FilterBar activeCount={url.activeFilterCount} onClear={url.clearFilters}>
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
        {selectFilter("status", "Status", studentStatusOptions, status, (next) =>
          url.setFilter("status", next),
        )}
        <Field>
          <FieldLabel htmlFor="students-session">Session</FieldLabel>
          <Input
            id="students-session"
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
        <Field>
          <FieldLabel htmlFor="students-search">Name or email</FieldLabel>
          <Input
            id="students-search"
            key={url.query}
            defaultValue={url.query}
            onBlur={(event) => {
              const next = event.target.value.trim();
              if (next !== url.query) url.setQuery(next);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
        </Field>
      </FilterBar>
    </ShellContent>
  );
}

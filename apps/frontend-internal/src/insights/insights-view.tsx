"use client";

import {
  useCoursesList,
  useDepartmentsList,
  useFacultiesList,
  useInsightsFunnel,
  useInsightsQuery,
  useUniversitiesList,
} from "@heat/api-client";
import {
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
import { ChartCard } from "@heat/ui/charts";
import type { ChartSeries, UpToFive } from "@heat/ui/charts";
import { FilterBar, useTableUrlState } from "@heat/ui/data";
import { ShellContent } from "@heat/ui/shell";
import {
  funnelRows,
  funnelSummary,
  hasSuppressedValues,
  insightFilterKeys,
  isRangeInvalid,
  isSessionValid,
  stageLabels,
  suppressionNote,
  toInsightParams,
  trendRows,
  trendSummary,
} from "./insights-model";
import type { InsightFilterValues } from "./insights-model";

const optionLimit = 50;
const all = "all";

const trendSeries: UpToFive<ChartSeries> = [
  { key: "registered", label: stageLabels.registered },
  { key: "verified", label: stageLabels.verified },
  { key: "approved", label: stageLabels.approved },
  { key: "started", label: stageLabels.started },
  { key: "completed", label: stageLabels.completed },
];

export function InsightsView() {
  const url = useTableUrlState({ sortable: [], filters: insightFilterKeys });
  const values = url.filters as InsightFilterValues;
  const { from, to, course, university, faculty, department, session } = values;
  const rangeInvalid = isRangeInvalid(from, to);
  const sessionValid = isSessionValid(session);
  const enabled = !rangeInvalid && sessionValid;
  const params = toInsightParams(values);

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

  const funnel = useInsightsFunnel(params, { query: { enabled } });
  const trend = useInsightsQuery(
    "enrollments",
    { ...params, groupBy: "day" },
    { query: { enabled } },
  );

  const options = (
    placeholder: string,
    items: ReadonlyArray<{ id: string; name?: string; title?: string }> | undefined,
  ) => [
    { value: all, label: placeholder },
    ...(items ?? []).map((item) => ({ value: item.id, label: item.title ?? item.name ?? item.id })),
  ];

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
      <FieldLabel id={`insights-filter-${id}`}>{label}</FieldLabel>
      <Select
        items={items}
        value={value || all}
        disabled={disabled}
        onValueChange={(next) => onChange(next === all ? null : next)}
      >
        <SelectTrigger aria-labelledby={`insights-filter-${id}`} className="w-full">
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
      <FieldLabel htmlFor={`insights-${key}`}>{label}</FieldLabel>
      <Input
        id={`insights-${key}`}
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

  const status = (query: { isError: boolean; isPending: boolean }) =>
    query.isError ? "error" : enabled && query.isPending ? "loading" : "ready";

  const suppressionThreshold =
    funnel.data?.suppressionThreshold ?? trend.data?.suppressionThreshold ?? 5;

  return (
    <ShellContent>
      <PageHeader title="Insights" />
      <FilterBar activeCount={url.activeFilterCount} onClear={url.clearFilters}>
        {dateFilter("from", "From")}
        {dateFilter("to", "To")}
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
        <Field>
          <FieldLabel htmlFor="insights-session">Session</FieldLabel>
          <Input
            id="insights-session"
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
      </FilterBar>
      {hasSuppressedValues(funnel.data, trend.data) ? (
        <FieldDescription role="note">{suppressionNote(suppressionThreshold)}</FieldDescription>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Enrollment funnel"
          description="Students at each stage for the filters above."
          kind="bar"
          xKey="stage"
          xLabel="Stage"
          series={[{ key: "students", label: "Students" }]}
          data={funnel.data ? funnelRows(funnel.data) : []}
          summary={funnel.data ? funnelSummary(funnel.data) : "Enrollment funnel"}
          status={status(funnel)}
          onRetry={() => void funnel.refetch()}
        />
        <ChartCard
          title="Enrollment trend"
          description="Registrations, verifications, approvals, starts and completions per day."
          xKey="day"
          xLabel="Day"
          series={trendSeries}
          data={trend.data ? trendRows(trend.data) : []}
          summary={trend.data ? trendSummary(trend.data) : "Enrollment trend"}
          status={status(trend)}
          onRetry={() => void trend.refetch()}
        />
      </div>
    </ShellContent>
  );
}

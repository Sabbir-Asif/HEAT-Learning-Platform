"use client";

import { useAdminOverviewGet, useCoursesList } from "@heat/api-client";
import {
  ErrorState,
  Field,
  FieldLabel,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  StatCard,
} from "@heat/ui";
import { ChartCard } from "@heat/ui/charts";
import { useTableUrlState } from "@heat/ui/data";
import { ShellContent } from "@heat/ui/shell";
import { AwardIcon, ClockIcon, UserCheckIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import {
  oldestPendingValue,
  passRateDescription,
  passRateRows,
  passRateSummary,
  pendingQueueHref,
  showCourseSelector,
  statusRows,
  statusSummary,
} from "./overview-model";

const courseLimit = 50;
const all = "all";

export function OverviewView() {
  const url = useTableUrlState({ sortable: [], filters: ["course"] });
  const course = url.filters.course ?? "";
  const courses = useCoursesList({ page: 1, pageSize: courseLimit, status: "all" });
  const overview = useAdminOverviewGet(course ? { courseId: course } : {});
  const data = overview.data;
  const status = overview.isError ? "error" : overview.isPending ? "loading" : "ready";
  const courseItems = [
    { value: all, label: "All courses" },
    ...(courses.data?.items ?? []).map((item) => ({ value: item.id, label: item.title })),
  ];

  return (
    <ShellContent>
      <PageHeader title="Overview" />
      {showCourseSelector(courses.data?.total ?? 0) ? (
        <Field>
          <FieldLabel id="overview-course">Course</FieldLabel>
          <Select
            items={courseItems}
            value={course || all}
            onValueChange={(next) => url.setFilter("course", next === all ? null : next)}
          >
            <SelectTrigger aria-labelledby="overview-course" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {courseItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}
      {status === "error" ? (
        <ErrorState
          title="The overview could not be loaded"
          onRetry={() => void overview.refetch()}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {data ? (
            <>
              <Link
                href={pendingQueueHref(course)}
                aria-label="Open the approval queue, oldest first"
              >
                <StatCard
                  icon={UserCheckIcon}
                  label="Awaiting approval"
                  value={String(data.pending.count)}
                />
              </Link>
              <StatCard
                icon={ClockIcon}
                label="Oldest waiting request"
                value={oldestPendingValue(data.pending)}
              />
              <StatCard
                icon={UsersIcon}
                label="Enrollments"
                value={String(data.totalEnrollments)}
              />
              <StatCard
                icon={AwardIcon}
                label="Certificates issued"
                value={String(data.certificatesIssued)}
              />
            </>
          ) : (
            [0, 1, 2, 3].map((slot) => <Skeleton key={slot} className="h-28 w-full rounded-xl" />)
          )}
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Enrollments by status"
          description="Every enrollment, counted live."
          kind="bar"
          xKey="status"
          xLabel="Status"
          xTickMaxLength={18}
          series={[{ key: "count", label: "Enrollments" }]}
          data={data ? statusRows(data) : []}
          summary={data ? statusSummary(data) : "Enrollments by status"}
          status={status}
          onRetry={() => void overview.refetch()}
        />
        <ChartCard
          title="Pass rate per module"
          description={passRateDescription(data)}
          kind="bar"
          xKey="module"
          xLabel="Module"
          xTickMaxLength={18}
          series={[{ key: "passRate", label: "Pass rate (%)" }]}
          data={data ? passRateRows(data) : []}
          summary={data ? passRateSummary(data) : "Pass rate per module"}
          status={status}
          onRetry={() => void overview.refetch()}
        />
      </div>
    </ShellContent>
  );
}

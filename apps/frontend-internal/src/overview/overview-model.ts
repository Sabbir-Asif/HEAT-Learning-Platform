import type { AdminOverviewDto } from "@heat/api-client";
import type { EnrollmentStatusName } from "@heat/contracts";
import type { ChartRow } from "@heat/ui/charts";

export const statusLabels: Record<EnrollmentStatusName, string> = {
  PENDING_VERIFICATION: "Awaiting email check",
  PENDING_APPROVAL: "Awaiting approval",
  APPROVED: "Approved",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  REMOVED: "Removed",
};

const dhakaFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka",
  dateStyle: "medium",
  timeStyle: "short",
});

const secondsPerMinute = 60;
const secondsPerHour = 3600;
const secondsPerDay = 86400;

export const showCourseSelector = (courseTotal: number): boolean => courseTotal > 1;

export const pendingQueueHref = (courseId: string): string => {
  const params = new URLSearchParams({ sort: "requestedAt" });
  if (courseId) params.set("course", courseId);
  return `/enrollments?${params.toString()}`;
};

const plural = (count: number, unit: string): string => `${count} ${unit}${count === 1 ? "" : "s"}`;

export const formatAge = (seconds: number): string => {
  if (seconds >= secondsPerDay) return plural(Math.floor(seconds / secondsPerDay), "day");
  if (seconds >= secondsPerHour) return plural(Math.floor(seconds / secondsPerHour), "hour");
  return plural(Math.max(1, Math.floor(seconds / secondsPerMinute)), "minute");
};

export const oldestPendingValue = (pending: AdminOverviewDto["pending"]): string =>
  pending.oldestAgeSeconds === null ? "None waiting" : formatAge(pending.oldestAgeSeconds);

export const asOfLabel = (refreshedAt: string | null): string =>
  refreshedAt === null
    ? "Pass rates are not available yet. The first nightly refresh has not finished."
    : `Pass rates as of ${dhakaFormatter.format(new Date(refreshedAt))} (Asia/Dhaka).`;

export const statusRows = (overview: AdminOverviewDto): ChartRow[] =>
  overview.totalEnrollments === 0
    ? []
    : overview.statusCounts.map((row) => ({ status: statusLabels[row.status], count: row.count }));

export const statusSummary = (overview: AdminOverviewDto): string =>
  `Enrollments by status. ${overview.statusCounts
    .map((row) => `${statusLabels[row.status]} ${row.count}`)
    .join(", ")}.`;

export const passRateRows = (overview: AdminOverviewDto): ChartRow[] =>
  overview.passRates
    .filter((row) => !row.suppressed && row.passRate !== null)
    .map((row) => ({ module: row.label, passRate: row.passRate }));

export const passRateSummary = (overview: AdminOverviewDto): string =>
  `Pass rate per module. ${overview.passRates
    .map((row) => `${row.label} ${row.passRate === null ? "withheld" : `${row.passRate}%`}`)
    .join(", ")}.`;

export const withheldNote = (overview: AdminOverviewDto): string | null => {
  const withheld = overview.passRates.filter((row) => row.suppressed);
  if (withheld.length === 0) return null;
  const names = withheld.map((row) => row.label).join(", ");
  return `Not shown because fewer than ${overview.suppressionThreshold} students took the quiz: ${names}.`;
};

export const passRateDescription = (overview: AdminOverviewDto | undefined): string => {
  const base = asOfLabel(overview?.refreshedAt ?? null);
  const note = overview ? withheldNote(overview) : null;
  return note === null ? base : `${base} ${note}`;
};

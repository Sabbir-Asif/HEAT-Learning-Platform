import type {
  InsightFunnelResultDto,
  InsightMissedQuestionsDto,
  InsightModuleResultsDto,
  InsightQuizResultsDto,
  InsightResultDto,
  InsightsFunnelParams,
} from "@heat/api-client";
import { academicSessionSchema } from "@heat/contracts";
import type { InsightFunnelStage } from "@heat/contracts";
import type { ChartRow } from "@heat/ui/charts";

export const insightFilterKeys = [
  "from",
  "to",
  "course",
  "university",
  "faculty",
  "department",
  "session",
  "quiz",
] as const;

export type InsightFilterValues = Record<(typeof insightFilterKeys)[number], string>;

export const stageLabels: Record<InsightFunnelStage["key"], string> = {
  registered: "Registered",
  verified: "Verified",
  approved: "Approved",
  started: "Started",
  completed: "Completed",
};

export const isSessionValid = (session: string): boolean =>
  session === "" || academicSessionSchema.safeParse(session).success;

export const isRangeInvalid = (from: string, to: string): boolean =>
  Boolean(from && to && to < from);

export const toInsightParams = (filters: InsightFilterValues): InsightsFunnelParams => ({
  ...(filters.from ? { from: filters.from } : {}),
  ...(filters.to ? { to: filters.to } : {}),
  ...(filters.course ? { courseId: filters.course } : {}),
  ...(filters.university ? { universityId: filters.university } : {}),
  ...(filters.university && filters.faculty ? { facultyId: filters.faculty } : {}),
  ...(filters.university && filters.faculty && filters.department
    ? { departmentId: filters.department }
    : {}),
  ...(filters.session && isSessionValid(filters.session) ? { session: filters.session } : {}),
});

export const funnelRows = (funnel: InsightFunnelResultDto): ChartRow[] => {
  const hasData = funnel.suppressed || funnel.stages.some((stage) => (stage.value ?? 0) > 0);
  if (!hasData) return [];
  return funnel.stages.map((stage) => ({
    stage: stageLabels[stage.key],
    students: stage.value,
  }));
};

export const trendRows = (result: InsightResultDto): ChartRow[] =>
  result.groups.map((group) => ({
    day: group.label,
    ...Object.fromEntries(result.columns.map((column) => [column, group.values[column] ?? null])),
  }));

export const hasSuppressedValues = (
  funnel: InsightFunnelResultDto | undefined,
  trend: InsightResultDto | undefined,
  modules?: InsightModuleResultsDto,
  quizzes?: InsightQuizResultsDto,
): boolean =>
  Boolean(funnel?.suppressed) ||
  Boolean(trend?.groups.some((group) => group.suppressed)) ||
  Boolean(modules?.rows.some((row) => row.suppressed)) ||
  Boolean(quizzes?.rows.some((row) => row.suppressed));

export const completionRows = (results: InsightModuleResultsDto): ChartRow[] =>
  results.rows.map((row) => ({ module: row.label, completionRate: row.completionRate }));

export const dropOffRows = (results: InsightModuleResultsDto): ChartRow[] =>
  results.rows.map((row) => ({ module: row.label, dropOff: row.dropOff }));

export const passRateRows = (results: InsightQuizResultsDto): ChartRow[] =>
  results.rows.map((row) => ({ quiz: row.label, passRate: row.passRate }));

export const attemptRows = (results: InsightQuizResultsDto): ChartRow[] =>
  results.rows.map((row) => ({ quiz: row.label, averageAttempts: row.averageAttempts }));

export const selectedQuizId = (
  results: InsightQuizResultsDto | undefined,
  requested: string,
): string => {
  const rows = results?.rows ?? [];
  const requestedRow = rows.find((row) => row.quizId === requested && !row.suppressed);
  return requestedRow?.quizId ?? rows.find((row) => !row.suppressed)?.quizId ?? "";
};

export const missedRows = (result: InsightMissedQuestionsDto): ChartRow[] =>
  result.rows.map((row) => ({
    question: `Q${row.order}. ${row.text} (${row.answered} ${row.answered === 1 ? "answer" : "answers"})`,
    missPercent: row.missPercent,
  }));

export const missedNote = (result: InsightMissedQuestionsDto | undefined): string => {
  const base = "Share of answers that were wrong, with the number of answers it rests on.";
  const withheld = result?.suppressedCount ?? 0;
  if (withheld === 0) return base;
  const threshold = result?.suppressionThreshold ?? 5;
  return `${base} ${withheld} ${withheld === 1 ? "question is" : "questions are"} not listed because fewer than ${threshold} students answered ${withheld === 1 ? "it" : "them"}.`;
};

const percent = (value: number | null): string => (value === null ? "withheld" : `${value}%`);

export const completionSummary = (results: InsightModuleResultsDto): string =>
  `Completion rate per module. ${results.rows
    .map((row) => `${row.label} ${percent(row.completionRate)}`)
    .join(", ")}.`;

export const dropOffSummary = (results: InsightModuleResultsDto): string =>
  `Students whose last module reached was each module. ${results.rows
    .map((row) => `${row.label} ${row.dropOff ?? "withheld"}`)
    .join(", ")}.`;

export const passRateSummary = (results: InsightQuizResultsDto): string =>
  `Pass rate per quiz. ${results.rows
    .map((row) => `${row.label} ${percent(row.passRate)}`)
    .join(", ")}.`;

export const attemptSummary = (results: InsightQuizResultsDto): string =>
  `Average attempts per student for each quiz. ${results.rows
    .map((row) => `${row.label} ${row.averageAttempts ?? "withheld"}`)
    .join(", ")}.`;

export const missedSummary = (result: InsightMissedQuestionsDto): string =>
  `Most-missed questions in ${result.label}. ${result.rows
    .map((row) => `Question ${row.order} ${row.missPercent}% of ${row.answered} answers`)
    .join(", ")}.`;

export const suppressionNote = (threshold: number): string =>
  `Values for fewer than ${threshold} students are withheld to protect privacy. They are left blank in the charts, the tables and the CSV files.`;

export const funnelSummary = (funnel: InsightFunnelResultDto): string => {
  if (funnel.suppressed)
    return "Enrollment funnel. All values are withheld because the group is too small.";
  return `Enrollment funnel. ${funnel.stages
    .map((stage) => `${stageLabels[stage.key]} ${stage.value ?? 0}`)
    .join(", ")}.`;
};

export const trendSummary = (result: InsightResultDto): string => {
  const first = result.groups[0]?.label;
  const last = result.groups.at(-1)?.label;
  const withheld = result.groups.filter((group) => group.suppressed).length;
  const totals = result.columns
    .map((column) => {
      const sum = result.groups.reduce((total, group) => total + (group.values[column] ?? 0), 0);
      return `${stageLabels[column as InsightFunnelStage["key"]] ?? column} ${sum}`;
    })
    .join(", ");
  const range = first === undefined || last === undefined ? "" : ` from ${first} to ${last}`;
  const note =
    withheld > 0 ? ` ${withheld} ${withheld === 1 ? "day is" : "days are"} withheld.` : "";
  return `Daily enrollment activity${range}. Totals of the days shown: ${totals}.${note}`;
};

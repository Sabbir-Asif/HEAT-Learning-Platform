import {
  insightSeriesColumns,
  insightSeriesGroupBy,
  insightSuppressionThreshold,
} from "@heat/contracts";
import type { InsightFilters, InsightGroup, InsightGroupBy, InsightSeries } from "@heat/contracts";
import type { Prisma } from "@heat/db";
import { dayAsDate, emptyMetrics, rollupMetrics } from "../core";
import type { RollupKind, RollupMetric, RollupMetrics } from "../core";

export const kindBySeries: Record<InsightSeries, RollupKind> = {
  enrollments: "ENROLLMENT",
  modules: "MODULE",
  quizzes: "QUIZ",
  questions: "QUESTION",
};

export interface QueryRow {
  day: string;
  courseId: string;
  moduleId: string | null;
  questionId: string | null;
  universityId: string;
  facultyId: string;
  departmentId: string;
  session: string;
  metrics: RollupMetrics;
}

export const isGroupByAllowed = (series: InsightSeries, groupBy: InsightGroupBy): boolean =>
  (insightSeriesGroupBy[series] as readonly InsightGroupBy[]).includes(groupBy);

export const buildRollupWhere = (
  series: InsightSeries,
  filters: InsightFilters,
): Prisma.InsightRollupWhereInput => {
  const range: Prisma.DateTimeFilter = {};
  if (filters.from !== undefined) range.gte = dayAsDate(filters.from);
  if (filters.to !== undefined) range.lte = dayAsDate(filters.to);
  return {
    kind: kindBySeries[series],
    ...(filters.from === undefined && filters.to === undefined ? {} : { day: range }),
    ...(filters.courseId === undefined ? {} : { courseId: filters.courseId }),
    ...(filters.universityId === undefined ? {} : { universityId: filters.universityId }),
    ...(filters.facultyId === undefined ? {} : { facultyId: filters.facultyId }),
    ...(filters.departmentId === undefined ? {} : { departmentId: filters.departmentId }),
    ...(filters.session === undefined ? {} : { session: filters.session }),
  };
};

export const groupKeyOf = (row: QueryRow, groupBy: InsightGroupBy): string => {
  switch (groupBy) {
    case "day":
      return row.day;
    case "month":
      return row.day.slice(0, 7);
    case "course":
      return row.courseId;
    case "module":
      return row.moduleId ?? "";
    case "question":
      return row.questionId ?? "";
    case "university":
      return row.universityId;
    case "faculty":
      return row.facultyId;
    case "department":
      return row.departmentId;
    case "session":
      return row.session;
  }
};

export const studentsIn = (series: InsightSeries, totals: RollupMetrics): number => {
  switch (series) {
    case "enrollments":
      return Math.max(
        totals.registered,
        totals.verified,
        totals.approved,
        totals.started,
        totals.completed,
      );
    case "modules":
      return Math.max(totals.started, totals.quizReady, totals.completed);
    case "quizzes":
      return totals.attemptedStudents;
    case "questions":
      return totals.askedStudents;
  }
};

export interface GroupTotals {
  key: string;
  totals: RollupMetrics;
}

export class GroupAccumulator {
  private readonly groups = new Map<string, RollupMetrics>();

  constructor(private readonly groupBy: InsightGroupBy) {}

  add(row: QueryRow): void {
    const key = groupKeyOf(row, this.groupBy);
    let totals = this.groups.get(key);
    if (totals === undefined) {
      totals = emptyMetrics();
      this.groups.set(key, totals);
    }
    for (const metric of rollupMetrics) totals[metric] += row.metrics[metric];
  }

  result(): GroupTotals[] {
    return [...this.groups.entries()].map(([key, totals]) => ({ key, totals }));
  }
}

const nullValues = (columns: readonly string[]): Record<string, number | null> =>
  Object.fromEntries(columns.map((column) => [column, null]));

export const toInsightGroup = (
  series: InsightSeries,
  group: GroupTotals,
  label: string,
  threshold: number = insightSuppressionThreshold,
): InsightGroup => {
  const columns: readonly RollupMetric[] = insightSeriesColumns[series];
  const students = studentsIn(series, group.totals);
  if (students < threshold) {
    return { key: group.key, label, suppressed: true, students: null, values: nullValues(columns) };
  }
  return {
    key: group.key,
    label,
    suppressed: false,
    students,
    values: Object.fromEntries(columns.map((column) => [column, group.totals[column]])),
  };
};

const formulaPrefix = /^[=+\-@\t\r]/;

const csvCell = (value: string | number | null): string => {
  if (value === null) return "";
  const text = typeof value === "number" ? String(value) : value;
  const safe = formulaPrefix.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

export const toCsv = (columns: readonly string[], groups: readonly InsightGroup[]): string => {
  const lines = [["group", ...columns, "suppressed"].map(csvCell).join(",")];
  for (const group of groups) {
    const cells = [
      group.label,
      ...columns.map((column) => group.values[column] ?? null),
      group.suppressed ? "yes" : "no",
    ];
    lines.push(cells.map(csvCell).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
};

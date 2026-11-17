import { z } from "zod";
import { academicSessionSchema } from "./academic-session";

export const insightSuppressionThreshold = 5;

export const insightSeriesList = ["enrollments", "modules", "quizzes", "questions"] as const;

export const insightSeriesSchema = z.enum(insightSeriesList);

export type InsightSeries = z.infer<typeof insightSeriesSchema>;

export const insightGroupByList = [
  "day",
  "month",
  "course",
  "module",
  "question",
  "university",
  "faculty",
  "department",
  "session",
] as const;

export const insightGroupBySchema = z.enum(insightGroupByList);

export type InsightGroupBy = z.infer<typeof insightGroupBySchema>;

export const insightSeriesColumns = {
  enrollments: ["registered", "verified", "approved", "started", "completed"],
  modules: ["started", "quizReady", "completed"],
  quizzes: ["attempts", "passedAttempts", "attemptedStudents", "passedStudents"],
  questions: ["answered", "missed"],
} as const satisfies Record<InsightSeries, readonly string[]>;

const commonGroupBy = [
  "day",
  "month",
  "course",
  "university",
  "faculty",
  "department",
  "session",
] as const satisfies readonly InsightGroupBy[];

export const insightSeriesGroupBy = {
  enrollments: commonGroupBy,
  modules: [...commonGroupBy, "module"],
  quizzes: [...commonGroupBy, "module"],
  questions: [...commonGroupBy, "module", "question"],
} as const satisfies Record<InsightSeries, readonly InsightGroupBy[]>;

export const insightDefaultGroupBy = {
  enrollments: "day",
  modules: "module",
  quizzes: "module",
  questions: "question",
} as const satisfies Record<InsightSeries, InsightGroupBy>;

const insightDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD.")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
  }, "Enter a real date.");

export const insightFilterShape = {
  from: insightDateSchema.optional(),
  to: insightDateSchema.optional(),
  courseId: z.uuid().optional(),
  universityId: z.uuid().optional(),
  facultyId: z.uuid().optional(),
  departmentId: z.uuid().optional(),
  session: academicSessionSchema.optional(),
};

const dateRangeIsOrdered = (query: { from?: string | undefined; to?: string | undefined }) =>
  query.from === undefined || query.to === undefined || query.from <= query.to;

const dateRangeMessage = {
  message: "The end date must not be before the start date.",
  path: ["to"],
};

export const insightFiltersSchema = z.object(insightFilterShape);

export type InsightFilters = z.infer<typeof insightFiltersSchema>;

export const insightQuerySchema = z
  .object({ ...insightFilterShape, groupBy: insightGroupBySchema.optional() })
  .refine(dateRangeIsOrdered, dateRangeMessage);

export type InsightQuery = z.infer<typeof insightQuerySchema>;

export const insightSeriesParamsSchema = z.object({ series: insightSeriesSchema });

export type InsightSeriesParams = z.infer<typeof insightSeriesParamsSchema>;

export const insightGroupSchema = z.object({
  key: z.string(),
  label: z.string(),
  suppressed: z.boolean(),
  students: z.number().int().nonnegative().nullable(),
  values: z.record(z.string(), z.number().int().nonnegative().nullable()),
});

export type InsightGroup = z.infer<typeof insightGroupSchema>;

export const insightResultSchema = z.object({
  series: insightSeriesSchema,
  groupBy: insightGroupBySchema,
  columns: z.array(z.string()),
  groups: z.array(insightGroupSchema),
  suppressionThreshold: z.number().int().positive(),
  refreshedAt: z.iso.datetime().nullable(),
});

export type InsightResult = z.infer<typeof insightResultSchema>;

export const insightRunStatusSchema = z.enum(["PENDING", "RUNNING", "SUCCEEDED", "FAILED"]);

export const insightRunTriggerSchema = z.enum(["NIGHTLY", "MANUAL", "BACKFILL"]);

export const insightRunSummarySchema = z.object({
  id: z.uuid(),
  trigger: insightRunTriggerSchema,
  status: insightRunStatusSchema,
  fromDay: insightDateSchema,
  toDay: insightDateSchema,
  requestedAt: z.iso.datetime(),
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
  rowsWritten: z.number().int().nonnegative(),
  failed: z.boolean(),
});

export type InsightRunSummary = z.infer<typeof insightRunSummarySchema>;

export const insightStatusResponseSchema = z.object({
  running: z.boolean(),
  activeRun: insightRunSummarySchema.nullable(),
  lastRun: insightRunSummarySchema.nullable(),
  lastSuccessfulAt: z.iso.datetime().nullable(),
});

export type InsightStatusResponse = z.infer<typeof insightStatusResponseSchema>;

export const insightRefreshResponseSchema = z.object({
  run: insightRunSummarySchema,
});

export type InsightRefreshResponse = z.infer<typeof insightRefreshResponseSchema>;

import { z } from "zod";
import { enrollmentStatusSchema, enrollmentStatuses } from "./auth";

export const adminOverviewQuerySchema = z.object({
  courseId: z.uuid().optional(),
});

export type AdminOverviewQuery = z.infer<typeof adminOverviewQuerySchema>;

export const adminOverviewStatusCountSchema = z.object({
  status: enrollmentStatusSchema,
  count: z.number().int().nonnegative(),
});

export type AdminOverviewStatusCount = z.infer<typeof adminOverviewStatusCountSchema>;

export const adminOverviewPendingSchema = z.object({
  count: z.number().int().nonnegative(),
  oldestRequestedAt: z.iso.datetime().nullable(),
  oldestAgeSeconds: z.number().int().nonnegative().nullable(),
});

export type AdminOverviewPending = z.infer<typeof adminOverviewPendingSchema>;

export const adminOverviewPassRateSchema = z.object({
  moduleId: z.string(),
  label: z.string(),
  suppressed: z.boolean(),
  students: z.number().int().nonnegative().nullable(),
  passRate: z.number().nonnegative().nullable(),
});

export type AdminOverviewPassRate = z.infer<typeof adminOverviewPassRateSchema>;

export const adminOverviewSchema = z.object({
  statusCounts: z.array(adminOverviewStatusCountSchema),
  totalEnrollments: z.number().int().nonnegative(),
  pending: adminOverviewPendingSchema,
  certificatesIssued: z.number().int().nonnegative(),
  passRates: z.array(adminOverviewPassRateSchema),
  suppressionThreshold: z.number().int().positive(),
  refreshedAt: z.iso.datetime().nullable(),
});

export type AdminOverview = z.infer<typeof adminOverviewSchema>;

export const adminOverviewStatusOrder = enrollmentStatuses;

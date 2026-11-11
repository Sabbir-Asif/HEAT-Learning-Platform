import { z } from "zod";
import { approvalReasonMaxLength } from "./approvals";
import { enrollmentStatusSchema } from "./auth";
import { dashboardCertificateSchema } from "./certificates";

export const dashboardNextModuleSchema = z.object({
  id: z.uuid(),
  order: z.number().int(),
  title: z.string(),
  resumeVideoId: z.uuid().nullable(),
  resumePositionSeconds: z.number().int().min(0),
});

export const dashboardProgressSchema = z.object({
  modulesCompleted: z.number().int().min(0),
  modulesTotal: z.number().int().min(0),
  percent: z.number().int().min(0).max(100),
});

export const dashboardCourseSchema = z.object({
  courseId: z.uuid(),
  courseSlug: z.string(),
  courseTitle: z.string(),
  status: enrollmentStatusSchema,
  reason: z.string().max(approvalReasonMaxLength).nullable(),
  progress: dashboardProgressSchema.nullable(),
  nextModule: dashboardNextModuleSchema.nullable(),
  certificate: dashboardCertificateSchema.nullable(),
});

export type DashboardCourse = z.infer<typeof dashboardCourseSchema>;

export const dashboardResponseSchema = z.object({
  courses: z.array(dashboardCourseSchema),
});

export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;

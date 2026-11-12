import { z } from "zod";
import { academicSessionSchema } from "./academic-session";

export const studentEnrollmentStatuses = [
  "PENDING_VERIFICATION",
  "PENDING_APPROVAL",
  "APPROVED",
  "COMPLETED",
  "REJECTED",
  "EXPIRED",
  "REMOVED",
] as const;

export const studentEnrollmentStatusSchema = z.enum(studentEnrollmentStatuses);

export type StudentEnrollmentStatus = z.infer<typeof studentEnrollmentStatusSchema>;

export const studentSearchMaxLength = 100;

export const studentFilterSchema = z.object({
  courseId: z.uuid().optional(),
  universityId: z.uuid().optional(),
  facultyId: z.uuid().optional(),
  departmentId: z.uuid().optional(),
  session: academicSessionSchema.optional(),
  status: studentEnrollmentStatusSchema.optional(),
  search: z.string().trim().min(1).max(studentSearchMaxLength).optional(),
});

export type StudentFilter = z.infer<typeof studentFilterSchema>;
export type StudentFilterInput = z.input<typeof studentFilterSchema>;

export const studentExportQuerySchema = studentFilterSchema;

export type StudentExportQuery = StudentFilter;

export const studentExportFileName = "students.csv";

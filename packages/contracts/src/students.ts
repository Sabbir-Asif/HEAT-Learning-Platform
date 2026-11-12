import { z } from "zod";
import { academicSessionSchema } from "./academic-session";
import { adminPageSizes } from "./admins";
import { enrollmentStatusSchema } from "./auth";
import { certificateStatusSchema } from "./certificates";

export const studentSortFields = ["name", "-name", "requestedAt", "-requestedAt"] as const;
export const studentSearchMaxLength = 100;

const optionalUuid = z.uuid().optional();

export const studentListQuerySchema = z.object({
  courseId: optionalUuid,
  universityId: optionalUuid,
  facultyId: optionalUuid,
  departmentId: optionalUuid,
  session: academicSessionSchema.optional(),
  status: enrollmentStatusSchema.optional(),
  q: z
    .string()
    .trim()
    .max(studentSearchMaxLength)
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
  sort: z.enum(studentSortFields).default("name"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((value) => (adminPageSizes as readonly number[]).includes(value), "Invalid page size")
    .default(25),
});

export type StudentListQuery = z.infer<typeof studentListQuerySchema>;
export type StudentListQueryInput = z.input<typeof studentListQuerySchema>;

const namedSchema = z.object({ id: z.uuid(), name: z.string() });

export const studentListItemSchema = z.object({
  id: z.uuid(),
  status: enrollmentStatusSchema,
  requestedAt: z.iso.datetime(),
  student: z.object({ userId: z.uuid(), name: z.string(), email: z.string() }),
  course: z.object({ id: z.uuid(), title: z.string() }),
  university: namedSchema,
  faculty: namedSchema,
  department: namedSchema,
  session: z.string(),
});

export type StudentListItem = z.infer<typeof studentListItemSchema>;

export const studentListResponseSchema = z.object({
  items: z.array(studentListItemSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export type StudentListResponse = z.infer<typeof studentListResponseSchema>;

export const moduleProgressStatusSchema = z.enum([
  "LOCKED",
  "UNLOCKED",
  "IN_PROGRESS",
  "QUIZ_READY",
  "COMPLETED",
]);

export const studentDecisionActionSchema = z.enum(["APPROVE", "REJECT", "REMOVE", "REINSTATE"]);

export const studentDetailParamsSchema = z.object({ id: z.uuid() });

export type StudentDetailParams = z.infer<typeof studentDetailParamsSchema>;

export const studentDecisionSchema = z.object({
  id: z.uuid(),
  action: studentDecisionActionSchema,
  reason: z.string().max(1000).nullable(),
  decidedAt: z.iso.datetime(),
  admin: z.object({ id: z.uuid(), email: z.string() }),
});

export const studentVideoProgressSchema = z.object({
  videoId: z.uuid(),
  title: z.string(),
  required: z.boolean(),
  coveragePercent: z.number().int().min(0).max(100),
  meetsThreshold: z.boolean(),
});

export const studentQuizAttemptSchema = z.object({
  id: z.uuid(),
  startedAt: z.iso.datetime(),
  submittedAt: z.iso.datetime().nullable(),
  scorePercent: z.number().int().nullable(),
  passMarkSnapshot: z.number().int(),
  passed: z.boolean(),
});

export const studentModuleProgressSchema = z.object({
  moduleId: z.uuid(),
  order: z.number().int(),
  title: z.string(),
  status: moduleProgressStatusSchema,
  completedAt: z.iso.datetime().nullable(),
  videos: z.array(studentVideoProgressSchema),
  quizAttempts: z.array(studentQuizAttemptSchema),
});

export const studentCertificateSchema = z.object({
  id: z.uuid(),
  number: z.string(),
  status: certificateStatusSchema,
  issuedAt: z.iso.datetime(),
  verificationUrl: z.url(),
});

export const studentEnrollmentDetailSchema = z.object({
  id: z.uuid(),
  status: enrollmentStatusSchema,
  requestedAt: z.iso.datetime(),
  approvedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  course: z.object({ id: z.uuid(), title: z.string() }),
  decisions: z.array(studentDecisionSchema),
  modules: z.array(studentModuleProgressSchema),
  certificate: studentCertificateSchema.nullable(),
});

export const studentDetailSchema = z.object({
  userId: z.uuid(),
  name: z.string(),
  email: z.string(),
  session: z.string(),
  university: namedSchema,
  faculty: namedSchema,
  department: namedSchema,
  enrollments: z.array(studentEnrollmentDetailSchema),
});

export type StudentDetail = z.infer<typeof studentDetailSchema>;
export type StudentEnrollmentDetail = z.infer<typeof studentEnrollmentDetailSchema>;
export type StudentModuleProgress = z.infer<typeof studentModuleProgressSchema>;

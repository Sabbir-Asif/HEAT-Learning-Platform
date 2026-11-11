import { z } from "zod";
import { academicSessionSchema } from "./academic-session";
import { adminPageSizes } from "./admins";
import { errorCodeSchema } from "./errors";

export const maxBulkApprovals = 100;
export const approvalReasonMaxLength = 500;
export const approvalReasonPresets = [
  "Eligible student of the listed department",
  "Details confirmed against the university records",
] as const;

export const approvalSortFields = ["requestedAt", "-requestedAt"] as const;

const dateSchema = z.iso.date();

const optionalUuid = z.uuid().optional();

const hasValidRange = (value: { submittedFrom?: string; submittedTo?: string }): boolean =>
  value.submittedFrom === undefined ||
  value.submittedTo === undefined ||
  value.submittedFrom <= value.submittedTo;

export const approvalQueueQuerySchema = z
  .object({
    courseId: optionalUuid,
    universityId: optionalUuid,
    facultyId: optionalUuid,
    departmentId: optionalUuid,
    session: academicSessionSchema.optional(),
    submittedFrom: dateSchema.optional(),
    submittedTo: dateSchema.optional(),
    sort: z.enum(approvalSortFields).default("requestedAt"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce
      .number()
      .int()
      .refine((value) => (adminPageSizes as readonly number[]).includes(value), "Invalid page size")
      .default(25),
  })
  .refine(hasValidRange, { path: ["submittedTo"], message: "End date is before the start date." });

export type ApprovalQueueQuery = z.infer<typeof approvalQueueQuerySchema>;
export type ApprovalQueueQueryInput = z.input<typeof approvalQueueQuerySchema>;

const namedSchema = z.object({ id: z.uuid(), name: z.string() });

export const approvalQueueItemSchema = z.object({
  id: z.uuid(),
  requestedAt: z.iso.datetime(),
  verifiedAt: z.iso.datetime().nullable(),
  student: z.object({ name: z.string(), email: z.string() }),
  course: z.object({ id: z.uuid(), title: z.string() }),
  university: namedSchema,
  faculty: namedSchema,
  department: namedSchema,
  session: z.string(),
});

export type ApprovalQueueItem = z.infer<typeof approvalQueueItemSchema>;

export const approvalQueueResponseSchema = z.object({
  items: z.array(approvalQueueItemSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export type ApprovalQueueResponse = z.infer<typeof approvalQueueResponseSchema>;

const reasonSchema = z
  .string()
  .trim()
  .max(approvalReasonMaxLength, `Use at most ${approvalReasonMaxLength} characters.`)
  .transform((value) => (value === "" ? undefined : value))
  .optional();

export const approveEnrollmentRequestSchema = z.object({ reason: reasonSchema });

export type ApproveEnrollmentRequest = z.infer<typeof approveEnrollmentRequestSchema>;

export const approveEnrollmentsRequestSchema = z.object({
  ids: z
    .array(z.uuid())
    .min(1, "Select at least one request.")
    .max(maxBulkApprovals, `Approve at most ${maxBulkApprovals} requests at a time.`)
    .refine((ids) => new Set(ids).size === ids.length, "Each request can be listed once."),
  reason: reasonSchema,
});

export type ApproveEnrollmentsRequest = z.infer<typeof approveEnrollmentsRequestSchema>;

export const enrollmentIdParamsSchema = z.object({ id: z.uuid() });

export const approvedEnrollmentSchema = z.object({
  id: z.uuid(),
  status: z.literal("APPROVED"),
  courseRevisionId: z.uuid(),
  approvedAt: z.iso.datetime(),
});

export type ApprovedEnrollment = z.infer<typeof approvedEnrollmentSchema>;

export const approvalFailureSchema = z.object({
  id: z.uuid(),
  code: errorCodeSchema,
});

export const bulkApprovalResponseSchema = z.object({
  succeeded: z.array(z.uuid()),
  failed: z.array(approvalFailureSchema),
});

export type BulkApprovalResponse = z.infer<typeof bulkApprovalResponseSchema>;

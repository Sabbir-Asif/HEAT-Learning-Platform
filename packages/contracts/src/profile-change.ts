import { z } from "zod";
import { adminPageSizes } from "./admins";
import { enrollmentStepOneSchema } from "./enrollment";
import { namedReferenceSchema } from "./profile";

export const profileChangeNoteMaxLength = 500;
export const profileChangeReasonMaxLength = 500;
export const profileChangeStatuses = ["PENDING", "APPROVED", "REJECTED"] as const;

export const profileChangeStatusSchema = z.enum(profileChangeStatuses);

export type ProfileChangeStatus = z.infer<typeof profileChangeStatusSchema>;

const noteSchema = z
  .string()
  .trim()
  .max(profileChangeNoteMaxLength, `Use at most ${profileChangeNoteMaxLength} characters.`)
  .transform((value) => (value === "" ? undefined : value))
  .optional();

export const submitProfileChangeRequestSchema = enrollmentStepOneSchema.extend({
  note: noteSchema,
});

export type SubmitProfileChangeRequest = z.infer<typeof submitProfileChangeRequestSchema>;
export type SubmitProfileChangeRequestInput = z.input<typeof submitProfileChangeRequestSchema>;

export const profileChangeReasonRequiredMessage = "Give a reason for the student.";

export const rejectProfileChangeRequestSchema = z.object({
  reason: z
    .string({ error: profileChangeReasonRequiredMessage })
    .trim()
    .min(1, profileChangeReasonRequiredMessage)
    .max(profileChangeReasonMaxLength, `Use at most ${profileChangeReasonMaxLength} characters.`),
});

export type RejectProfileChangeRequest = z.infer<typeof rejectProfileChangeRequestSchema>;

export const profileChangeIdParamsSchema = z.object({ id: z.uuid() });

export const profileChangeRequestedSchema = z.object({
  name: z.string().nullable(),
  university: namedReferenceSchema.nullable(),
  faculty: namedReferenceSchema.nullable(),
  department: namedReferenceSchema.nullable(),
  session: z.string().nullable(),
});

export type ProfileChangeRequested = z.infer<typeof profileChangeRequestedSchema>;

export const profileChangeRequestSchema = z.object({
  id: z.uuid(),
  status: profileChangeStatusSchema,
  requested: profileChangeRequestedSchema,
  note: z.string().nullable(),
  reason: z.string().nullable(),
  createdAt: z.iso.datetime(),
  decidedAt: z.iso.datetime().nullable(),
});

export type ProfileChangeRequestSummary = z.infer<typeof profileChangeRequestSchema>;

export const latestProfileChangeResponseSchema = z.object({
  request: profileChangeRequestSchema.nullable(),
});

export type LatestProfileChangeResponse = z.infer<typeof latestProfileChangeResponseSchema>;

export const profileChangeQuerySchema = z.object({
  status: profileChangeStatusSchema.default("PENDING"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((value) => (adminPageSizes as readonly number[]).includes(value), "Invalid page size")
    .default(25),
});

export type ProfileChangeQuery = z.infer<typeof profileChangeQuerySchema>;
export type ProfileChangeQueryInput = z.input<typeof profileChangeQuerySchema>;

export const profileChangeCurrentSchema = z.object({
  name: z.string(),
  university: namedReferenceSchema,
  faculty: namedReferenceSchema,
  department: namedReferenceSchema,
  session: z.string(),
});

export type ProfileChangeCurrent = z.infer<typeof profileChangeCurrentSchema>;

export const adminProfileChangeItemSchema = profileChangeRequestSchema.extend({
  student: z.object({ name: z.string(), email: z.string() }),
  current: profileChangeCurrentSchema,
});

export type AdminProfileChangeItem = z.infer<typeof adminProfileChangeItemSchema>;

export const adminProfileChangeListResponseSchema = z.object({
  items: z.array(adminProfileChangeItemSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export type AdminProfileChangeListResponse = z.infer<typeof adminProfileChangeListResponseSchema>;

export const profileChangeDecisionSchema = z.object({
  id: z.uuid(),
  status: profileChangeStatusSchema,
  decidedAt: z.iso.datetime(),
});

export type ProfileChangeDecision = z.infer<typeof profileChangeDecisionSchema>;

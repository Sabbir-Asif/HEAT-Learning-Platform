import { z } from "zod";
import { approvalReasonMaxLength } from "./approvals";

export const removeEnrollmentRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Give a reason for the removal.")
    .max(approvalReasonMaxLength, `Use at most ${approvalReasonMaxLength} characters.`),
});

export type RemoveEnrollmentRequest = z.infer<typeof removeEnrollmentRequestSchema>;

export const reinstateEnrollmentRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(approvalReasonMaxLength, `Use at most ${approvalReasonMaxLength} characters.`)
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
});

export type ReinstateEnrollmentRequest = z.infer<typeof reinstateEnrollmentRequestSchema>;

export const removedEnrollmentSchema = z.object({
  id: z.uuid(),
  status: z.literal("REMOVED"),
  removedAt: z.iso.datetime(),
});

export type RemovedEnrollment = z.infer<typeof removedEnrollmentSchema>;

export const reinstatedEnrollmentSchema = z.object({
  id: z.uuid(),
  status: z.enum(["APPROVED", "COMPLETED"]),
});

export type ReinstatedEnrollment = z.infer<typeof reinstatedEnrollmentSchema>;

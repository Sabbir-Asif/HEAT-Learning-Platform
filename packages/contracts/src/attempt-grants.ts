import { z } from "zod";
import { approvalReasonMaxLength } from "./approvals";

export const attemptGrantParamsSchema = z.object({ id: z.uuid(), quizId: z.uuid() });

export type AttemptGrantParams = z.infer<typeof attemptGrantParamsSchema>;

export const grantAttemptRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(approvalReasonMaxLength, `Use at most ${approvalReasonMaxLength} characters.`)
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
});

export type GrantAttemptRequest = z.infer<typeof grantAttemptRequestSchema>;

export const grantedAttemptSchema = z.object({
  id: z.uuid(),
  quizId: z.uuid(),
  grantedAttempts: z.number().int().min(1),
});

export type GrantedAttempt = z.infer<typeof grantedAttemptSchema>;

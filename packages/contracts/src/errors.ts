import { z } from "zod";

export const errorCodes = [
  "BAD_REQUEST",
  "FORBIDDEN",
  "INTERNAL",
  "NOT_FOUND",
  "RATE_LIMITED",
  "UNAUTHENTICATED",
  "VALIDATION_FAILED",
] as const;

export const clientErrorCodes = [
  "NETWORK_ERROR",
  "REQUEST_ABORTED",
  "UNEXPECTED_RESPONSE",
] as const;

export type ErrorCode = (typeof errorCodes)[number];
export type ClientErrorCode = (typeof clientErrorCodes)[number];

export const errorCodeSchema = z.enum(errorCodes);

export const fieldErrorSchema = z.object({
  path: z.string(),
  code: z.string(),
});

export const errorResponseSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    requestId: z.string(),
    fields: z.array(fieldErrorSchema).optional(),
  }),
});

export type FieldError = z.infer<typeof fieldErrorSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

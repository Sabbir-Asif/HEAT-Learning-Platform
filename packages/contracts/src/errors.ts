import { z } from "zod";

export const errorCodes = [
  "BAD_REQUEST",
  "CANNOT_DEACTIVATE_SELF",
  "CAPTCHA_EXPIRED",
  "CAPTCHA_INVALID",
  "CSRF_TOKEN_INVALID",
  "EMAIL_IN_USE",
  "ENROLLMENT_NOT_ACTIVE",
  "FORBIDDEN",
  "INTERNAL",
  "INVALID_CREDENTIALS",
  "INVITATION_EXPIRED",
  "INVITATION_INVALID",
  "INVITATION_NOT_PENDING",
  "NOT_FOUND",
  "ORIGIN_NOT_ALLOWED",
  "PASSWORD_BREACHED",
  "PASSWORD_CHANGE_REQUIRED",
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

export const fieldErrorCodes = [
  "custom",
  "invalid",
  "invalid_format",
  "invalid_type",
  "invalid_value",
  "required",
  "too_big",
  "too_small",
  "unrecognized_keys",
] as const;

export type FieldErrorCode = (typeof fieldErrorCodes)[number];

export const fieldErrorSchema = z.object({
  path: z.string(),
  code: z.enum(fieldErrorCodes),
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

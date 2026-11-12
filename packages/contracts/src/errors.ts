import { z } from "zod";

export const errorCodes = [
  "AUDIT_ACTOR_FILTER_TOO_BROAD",
  "BAD_REQUEST",
  "CANNOT_DEACTIVATE_SELF",
  "CAPTCHA_EXPIRED",
  "CAPTCHA_INVALID",
  "CERTIFICATE_NOT_READY",
  "CERTIFICATE_REVOKED",
  "CONTENT_LOCKED",
  "COURSE_HAS_ENROLLMENTS",
  "COURSE_LOCKED",
  "COURSE_NOT_AVAILABLE",
  "COURSE_NOT_DRAFT",
  "COURSE_NOT_PUBLISHED",
  "COURSE_PUBLISH_CHECKS_FAILED",
  "COURSE_REVISION_DRAFT_EXISTS",
  "COURSE_REVISION_NOT_DRAFT",
  "COURSE_SLUG_TAKEN",
  "CSRF_TOKEN_INVALID",
  "DIRECTORY_ARCHIVED",
  "DIRECTORY_IN_USE",
  "DIRECTORY_NAME_TAKEN",
  "EMAIL_IN_USE",
  "ENROLLMENT_ALREADY_DECIDED",
  "ENROLLMENT_NOT_ACTIVE",
  "ENROLLMENT_NOT_REMOVABLE",
  "ENROLLMENT_NOT_REMOVED",
  "ENROLLMENT_NOT_VERIFIED",
  "ENROLLMENT_STATE_CHANGED",
  "FORBIDDEN",
  "INTERNAL",
  "INVALID_CREDENTIALS",
  "INVITATION_EXPIRED",
  "INVITATION_INVALID",
  "INVITATION_NOT_PENDING",
  "MODULE_LOCKED",
  "NOT_FOUND",
  "ORDER_CONFLICT",
  "ORIGIN_NOT_ALLOWED",
  "PASSWORD_BREACHED",
  "PASSWORD_CHANGE_REQUIRED",
  "QUIZ_ANSWER_INVALID",
  "QUIZ_ATTEMPTS_UNLIMITED",
  "QUIZ_ATTEMPT_LIMIT_REACHED",
  "QUIZ_ATTEMPT_NOT_OPEN",
  "QUIZ_ATTEMPT_WAIT",
  "QUIZ_GRANT_NOT_NEEDED",
  "QUIZ_NOT_UNLOCKED",
  "RATE_LIMITED",
  "RESET_LINK_EXPIRED",
  "RESET_LINK_INVALID",
  "RESET_LINK_USED",
  "UNAUTHENTICATED",
  "UPLOAD_EXPIRED",
  "UPLOAD_OFFSET_MISMATCH",
  "UPLOAD_TOO_LARGE",
  "UPLOAD_TYPE_NOT_ALLOWED",
  "VALIDATION_FAILED",
  "VERIFICATION_LINK_EXPIRED",
  "VERIFICATION_LINK_INVALID",
  "VERIFICATION_LINK_USED",
  "VERIFICATION_RESEND_LIMIT",
  "VIDEO_NOT_FAILED",
  "VIDEO_NOT_READY",
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

export const errorDetailsSchema = z.object({
  nextAttemptAt: z.iso.datetime().optional(),
});

export const errorResponseSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    requestId: z.string(),
    fields: z.array(fieldErrorSchema).optional(),
    failures: z.array(z.string()).optional(),
    details: errorDetailsSchema.optional(),
  }),
});

export type ErrorDetails = z.infer<typeof errorDetailsSchema>;
export type FieldError = z.infer<typeof fieldErrorSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

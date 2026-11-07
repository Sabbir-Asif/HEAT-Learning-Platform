import { z } from "zod";

/**
 * Error codes the API sends. Public identifiers: never rename one, never reuse one for another
 * meaning. Add a code instead, and map it to a message in the frontends' catalogs.
 */
export const errorCodes = [
  "BAD_REQUEST",
  "FORBIDDEN",
  "INTERNAL",
  "NOT_FOUND",
  "RATE_LIMITED",
  "UNAUTHENTICATED",
  "VALIDATION_FAILED",
] as const;

/** Codes the API client raises itself when no API envelope arrived. The API never sends these. */
export const clientErrorCodes = [
  "NETWORK_ERROR",
  "REQUEST_ABORTED",
  "UNEXPECTED_RESPONSE",
] as const;

export type ErrorCode = (typeof errorCodes)[number];
export type ClientErrorCode = (typeof clientErrorCodes)[number];

export const errorCodeSchema = z.enum(errorCodes);

/** One failed field. `path` is dotted (`items.0.name`), the form React Hook Form uses. */
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

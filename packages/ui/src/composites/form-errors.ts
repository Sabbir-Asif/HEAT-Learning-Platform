export type FieldErrorCopyKey =
  | "custom"
  | "invalid"
  | "invalid_format"
  | "invalid_type"
  | "invalid_value"
  | "required"
  | "too_big"
  | "too_small"
  | "unrecognized_keys";

export type FormErrorCopyKey =
  | "BAD_REQUEST"
  | "FORBIDDEN"
  | "INTERNAL"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UNAUTHENTICATED"
  | "VALIDATION_FAILED"
  | "NETWORK_ERROR"
  | "REQUEST_ABORTED"
  | "UNEXPECTED_RESPONSE";

export const fieldErrorCopy: Record<FieldErrorCopyKey, string> = {
  custom: "This value is not accepted.",
  invalid: "This value is not valid.",
  invalid_format: "This is not in the expected format.",
  invalid_type: "This value is not the right type.",
  invalid_value: "Choose one of the available options.",
  required: "This field is required.",
  too_big: "This value is too large or too long.",
  too_small: "This value is too small or too short.",
  unrecognized_keys: "This value is not accepted.",
};

export const genericFormMessage =
  "Something in the form needs another look. Check it and try again.";

export const formErrorCopy: Record<FormErrorCopyKey, string> = {
  BAD_REQUEST: "The request could not be understood. Check the form and try again.",
  FORBIDDEN: "You do not have permission to do this.",
  INTERNAL: "Something went wrong on our side. Try again in a moment.",
  NOT_FOUND: "This item could not be found. It may have been removed.",
  RATE_LIMITED: "Too many attempts. Wait a little and try again.",
  UNAUTHENTICATED: "Your session has ended. Sign in again to continue.",
  VALIDATION_FAILED: genericFormMessage,
  NETWORK_ERROR: "The connection failed. Check your network and try again.",
  REQUEST_ABORTED: "The request was cancelled. Try again.",
  UNEXPECTED_RESPONSE: "The server sent an unexpected reply. Try again in a moment.",
};

export type FieldMessage = { path: string; message: string };

export type FormErrors = { fields: FieldMessage[]; formMessage?: string };

type ErrorPayload = {
  code: string;
  fields?: { path: string; code: string }[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readPayload(payload: unknown): ErrorPayload | undefined {
  if (!isRecord(payload) || !isRecord(payload.error)) return undefined;
  const { code, fields } = payload.error;
  if (typeof code !== "string") return undefined;
  if (!Array.isArray(fields)) return { code };
  const valid = fields.filter(
    (field): field is { path: string; code: string } =>
      isRecord(field) && typeof field.path === "string" && typeof field.code === "string",
  );
  return { code, fields: valid };
}

function hasFieldCopy(code: string): code is FieldErrorCopyKey {
  return code in fieldErrorCopy;
}

function hasFormCopy(code: string): code is FormErrorCopyKey {
  return code in formErrorCopy;
}

export function toFormErrors(payload: unknown, knownPaths: readonly string[]): FormErrors {
  const read = readPayload(payload);
  if (!read) return { fields: [], formMessage: genericFormMessage };

  if (!read.fields || read.fields.length === 0) {
    return {
      fields: [],
      formMessage: hasFormCopy(read.code) ? formErrorCopy[read.code] : genericFormMessage,
    };
  }

  const known = new Set(knownPaths);
  const seen = new Set<string>();
  const fields: FieldMessage[] = [];
  let unmatched = false;

  for (const field of read.fields) {
    if (!known.has(field.path)) {
      unmatched = true;
      continue;
    }
    if (seen.has(field.path)) continue;
    seen.add(field.path);
    fields.push({
      path: field.path,
      message: hasFieldCopy(field.code) ? fieldErrorCopy[field.code] : fieldErrorCopy.invalid,
    });
  }

  return unmatched ? { fields, formMessage: genericFormMessage } : { fields };
}

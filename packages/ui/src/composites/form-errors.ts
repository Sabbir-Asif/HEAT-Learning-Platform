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
  | "AUDIT_ACTOR_FILTER_TOO_BROAD"
  | "BAD_REQUEST"
  | "CANNOT_DEACTIVATE_SELF"
  | "CAPTCHA_EXPIRED"
  | "CAPTCHA_INVALID"
  | "CERTIFICATE_NOT_READY"
  | "CERTIFICATE_REVOKED"
  | "CONTENT_LOCKED"
  | "COURSE_HAS_ENROLLMENTS"
  | "COURSE_LOCKED"
  | "COURSE_NOT_AVAILABLE"
  | "COURSE_NOT_DRAFT"
  | "COURSE_NOT_PUBLISHED"
  | "COURSE_PUBLISH_CHECKS_FAILED"
  | "COURSE_REVISION_DRAFT_EXISTS"
  | "COURSE_REVISION_NOT_DRAFT"
  | "COURSE_SLUG_TAKEN"
  | "CSRF_TOKEN_INVALID"
  | "DIRECTORY_ARCHIVED"
  | "DIRECTORY_IN_USE"
  | "DIRECTORY_NAME_TAKEN"
  | "EMAIL_IN_USE"
  | "EMAIL_NOT_VERIFIED"
  | "ENROLLMENT_ALREADY_DECIDED"
  | "ENROLLMENT_NOT_ACTIVE"
  | "ENROLLMENT_NOT_REMOVABLE"
  | "ENROLLMENT_NOT_REMOVED"
  | "ENROLLMENT_STATE_CHANGED"
  | "ENROLLMENT_NOT_VERIFIED"
  | "FORBIDDEN"
  | "INTERNAL"
  | "INVALID_CREDENTIALS"
  | "INVITATION_EXPIRED"
  | "INVITATION_INVALID"
  | "INVITATION_NOT_PENDING"
  | "MODULE_LOCKED"
  | "NOT_FOUND"
  | "ORDER_CONFLICT"
  | "ORIGIN_NOT_ALLOWED"
  | "PASSWORD_BREACHED"
  | "PASSWORD_CHANGE_REQUIRED"
  | "QUIZ_ANSWER_INVALID"
  | "QUIZ_ATTEMPTS_UNLIMITED"
  | "QUIZ_ATTEMPT_LIMIT_REACHED"
  | "QUIZ_ATTEMPT_NOT_OPEN"
  | "QUIZ_ATTEMPT_WAIT"
  | "QUIZ_GRANT_NOT_NEEDED"
  | "QUIZ_NOT_UNLOCKED"
  | "RATE_LIMITED"
  | "RESET_LINK_EXPIRED"
  | "RESET_LINK_INVALID"
  | "RESET_LINK_USED"
  | "TAG_NAME_TAKEN"
  | "TAG_RESERVED"
  | "UNAUTHENTICATED"
  | "UPLOAD_DIMENSIONS_TOO_LARGE"
  | "UPLOAD_EXPIRED"
  | "UPLOAD_OFFSET_MISMATCH"
  | "UPLOAD_TOO_LARGE"
  | "UPLOAD_TYPE_NOT_ALLOWED"
  | "VALIDATION_FAILED"
  | "VERIFICATION_LINK_EXPIRED"
  | "VERIFICATION_LINK_INVALID"
  | "VERIFICATION_LINK_USED"
  | "VERIFICATION_RESEND_LIMIT"
  | "VIDEO_NOT_FAILED"
  | "VIDEO_NOT_READY"
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
  AUDIT_ACTOR_FILTER_TOO_BROAD:
    "That actor filter matches too many accounts. Type more of the email address.",
  BAD_REQUEST: "The request could not be understood. Check the form and try again.",
  CANNOT_DEACTIVATE_SELF: "You cannot deactivate your own account.",
  CAPTCHA_EXPIRED: "This security check can no longer be used. Request a new one.",
  CAPTCHA_INVALID: "The characters do not match. Try again.",
  CERTIFICATE_NOT_READY: "This certificate is still being prepared.",
  CERTIFICATE_REVOKED: "This certificate is revoked.",
  CONTENT_LOCKED:
    "This course is locked. Modules and sections cannot be added, removed or reordered.",
  COURSE_HAS_ENROLLMENTS: "This course has enrollments, so it cannot be deleted.",
  COURSE_LOCKED: "This course is locked. Only the description and thumbnail can be changed.",
  COURSE_NOT_AVAILABLE: "This course is not open for enrollment.",
  COURSE_NOT_DRAFT: "This action is only available for a draft course.",
  COURSE_NOT_PUBLISHED: "Publish the course before publishing a new revision.",
  COURSE_PUBLISH_CHECKS_FAILED: "The course is not ready to publish.",
  COURSE_REVISION_DRAFT_EXISTS:
    "A draft revision already exists. Publish it or finish it before cloning again.",
  COURSE_REVISION_NOT_DRAFT: "This revision is not an open draft.",
  COURSE_SLUG_TAKEN: "A course with this slug already exists.",
  CSRF_TOKEN_INVALID: "Your session check failed. Reload the page and try again.",
  DIRECTORY_ARCHIVED:
    "This record is archived, so it cannot be used for new records. Restore it first.",
  DIRECTORY_IN_USE: "This record is still in use, so it cannot be deleted.",
  DIRECTORY_NAME_TAKEN: "A record with this name already exists.",
  EMAIL_IN_USE: "An account with this email address already exists.",
  EMAIL_NOT_VERIFIED: "Verify your email address to request this course.",
  ENROLLMENT_ALREADY_DECIDED: "This request was already decided or was withdrawn.",
  ENROLLMENT_NOT_ACTIVE: "Your enrollment in this course is not active.",
  ENROLLMENT_NOT_REMOVABLE: "Only an approved or completed student can be removed.",
  ENROLLMENT_NOT_REMOVED: "This student is not removed, so there is nothing to reinstate.",
  ENROLLMENT_STATE_CHANGED: "This enrollment was changed by someone else. Reload and try again.",
  ENROLLMENT_NOT_VERIFIED:
    "The student has not verified their email yet, so it cannot be approved.",
  FORBIDDEN: "You do not have permission to do this.",
  INTERNAL: "Something went wrong on our side. Try again in a moment.",
  INVALID_CREDENTIALS: "The email or password is not correct.",
  INVITATION_EXPIRED: "This invitation has expired. Ask the super admin to send a new one.",
  INVITATION_INVALID: "This invitation link is not valid.",
  INVITATION_NOT_PENDING: "This admin has no pending invitation.",
  MODULE_LOCKED: "This module is locked until you finish the previous one.",
  NOT_FOUND: "This item could not be found. It may have been removed.",
  ORDER_CONFLICT: "Someone else changed this order. Reload the list and try again.",
  ORIGIN_NOT_ALLOWED: "This request did not come from an allowed site.",
  PASSWORD_BREACHED: "This password has appeared in a data breach. Choose a different one.",
  PASSWORD_CHANGE_REQUIRED: "Change your password to continue.",
  QUIZ_ANSWER_INVALID:
    "One of the answers does not belong to this quiz. Reload the quiz and try again.",
  QUIZ_ATTEMPTS_UNLIMITED: "This quiz has no attempt limit, so there is nothing to grant.",
  QUIZ_ATTEMPT_LIMIT_REACHED: "You have used all your attempts for this quiz.",
  QUIZ_ATTEMPT_NOT_OPEN:
    "This attempt was already submitted or is no longer open. Reload the quiz.",
  QUIZ_ATTEMPT_WAIT: "You need to wait before you can submit another attempt.",
  QUIZ_GRANT_NOT_NEEDED:
    "The student still has attempts left or has already passed, so no extra attempt is needed.",
  QUIZ_NOT_UNLOCKED: "Watch the required videos in this module to unlock the quiz.",
  RATE_LIMITED: "Too many attempts. Wait a little and try again.",
  RESET_LINK_EXPIRED: "This reset link has expired. Request a new one.",
  RESET_LINK_INVALID: "This reset link is not valid.",
  RESET_LINK_USED: "This reset link has already been used or replaced.",
  TAG_NAME_TAKEN: "A tag with this name already exists.",
  TAG_RESERVED: "The front page tag is built in and cannot be renamed or deleted.",
  UNAUTHENTICATED: "Your session has ended. Sign in again to continue.",
  UPLOAD_DIMENSIONS_TOO_LARGE: "This image has more pixels than the upload limit.",
  UPLOAD_EXPIRED: "This upload expired before it finished. Start it again.",
  UPLOAD_OFFSET_MISMATCH: "The upload got out of step with the server. Start it again.",
  UPLOAD_TOO_LARGE: "This file is larger than the upload limit.",
  UPLOAD_TYPE_NOT_ALLOWED: "This file is not a supported video. Use MP4, MOV, WebM or MKV.",
  VALIDATION_FAILED: genericFormMessage,
  VERIFICATION_LINK_EXPIRED: "This verification link has expired. Request a new one.",
  VERIFICATION_LINK_INVALID: "This verification link is not valid.",
  VERIFICATION_LINK_USED: "This verification link has already been used or replaced.",
  VERIFICATION_RESEND_LIMIT:
    "Too many verification emails were requested. Contact support if you still need help.",
  VIDEO_NOT_FAILED: "Only a video whose processing failed can be retried.",
  VIDEO_NOT_READY: "This video is not ready to play yet.",
  NETWORK_ERROR: "The connection failed. Check your network and try again.",
  REQUEST_ABORTED: "The request was cancelled. Try again.",
  UNEXPECTED_RESPONSE: "The server sent an unexpected reply. Try again in a moment.",
};

export function rateLimitedMessage(retryAfterSeconds?: number): string {
  if (retryAfterSeconds === undefined || retryAfterSeconds <= 0) return formErrorCopy.RATE_LIMITED;
  if (retryAfterSeconds < 60) {
    const seconds = Math.ceil(retryAfterSeconds);
    return `Too many attempts. Try again in ${seconds} ${seconds === 1 ? "second" : "seconds"}.`;
  }
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return `Too many attempts. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
}

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

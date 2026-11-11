import { isApiError } from "@heat/api-client";
import { formErrorCopy, genericFormMessage, rateLimitedMessage } from "@heat/ui";

export type VerificationFailure =
  { kind: "used" } | { kind: "expired" } | { kind: "invalid" } | { kind: "retry"; message: string };

export function classifyVerificationFailure(error: unknown): VerificationFailure {
  if (!isApiError(error)) return { kind: "retry", message: genericFormMessage };
  switch (error.code) {
    case "VERIFICATION_LINK_USED":
      return { kind: "used" };
    case "VERIFICATION_LINK_EXPIRED":
      return { kind: "expired" };
    case "VERIFICATION_LINK_INVALID":
      return { kind: "invalid" };
    case "RATE_LIMITED":
      return { kind: "retry", message: rateLimitedMessage(error.retryAfterSeconds) };
    default:
      return { kind: "retry", message: formErrorCopy[error.code] };
  }
}

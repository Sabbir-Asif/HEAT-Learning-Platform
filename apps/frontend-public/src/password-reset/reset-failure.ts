import { isApiError } from "@heat/api-client";
import { formErrorCopy, genericFormMessage, rateLimitedMessage } from "@heat/ui";

export type ResetFailure =
  { kind: "link" } | { kind: "breached"; message: string } | { kind: "retry"; message: string };

export function classifyResetFailure(error: unknown): ResetFailure {
  if (!isApiError(error)) return { kind: "retry", message: genericFormMessage };
  switch (error.code) {
    case "RESET_LINK_USED":
    case "RESET_LINK_EXPIRED":
    case "RESET_LINK_INVALID":
      return { kind: "link" };
    case "PASSWORD_BREACHED":
      return { kind: "breached", message: formErrorCopy.PASSWORD_BREACHED };
    case "RATE_LIMITED":
      return { kind: "retry", message: rateLimitedMessage(error.retryAfterSeconds) };
    default:
      return { kind: "retry", message: formErrorCopy[error.code] };
  }
}

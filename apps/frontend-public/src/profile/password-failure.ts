import { isApiError } from "@heat/api-client";
import { formErrorCopy, genericFormMessage, rateLimitedMessage } from "@heat/ui";

export type PasswordField = "currentPassword" | "code" | "newPassword";

export interface PasswordFailure {
  field?: PasswordField;
  message: string;
}

export const wrongCurrentPasswordMessage = "The current password is not correct.";

export function classifyPasswordFailure(error: unknown): PasswordFailure {
  if (!isApiError(error)) return { message: genericFormMessage };
  switch (error.code) {
    case "INVALID_CREDENTIALS":
      return { field: "currentPassword", message: wrongCurrentPasswordMessage };
    case "PASSWORD_CODE_INVALID":
    case "PASSWORD_CODE_EXPIRED":
      return { field: "code", message: formErrorCopy[error.code] };
    case "PASSWORD_BREACHED":
      return { field: "newPassword", message: formErrorCopy.PASSWORD_BREACHED };
    case "RATE_LIMITED":
      return { message: rateLimitedMessage(error.retryAfterSeconds) };
    default:
      return { message: formErrorCopy[error.code] };
  }
}

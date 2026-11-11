import { isApiError } from "@heat/api-client";
import { formErrorCopy, genericFormMessage, rateLimitedMessage } from "@heat/ui";

export interface SubmitFailure {
  refreshCaptcha: boolean;
  fieldPath?: "captchaAnswer" | "password";
  message?: string;
  payload?: { error: { code: string; fields: { path: string; code: string }[] } };
}

export function classifySubmitError(error: unknown): SubmitFailure {
  if (!isApiError(error)) return { refreshCaptcha: false, message: genericFormMessage };
  if (error.code === "RATE_LIMITED") {
    return { refreshCaptcha: false, message: rateLimitedMessage(error.retryAfterSeconds) };
  }
  if (error.code === "NETWORK_ERROR" || error.code === "REQUEST_ABORTED") {
    return { refreshCaptcha: false, message: formErrorCopy[error.code] };
  }
  if (error.code === "CAPTCHA_INVALID" || error.code === "CAPTCHA_EXPIRED") {
    return { refreshCaptcha: true, fieldPath: "captchaAnswer", message: formErrorCopy[error.code] };
  }
  if (error.code === "PASSWORD_BREACHED") {
    return { refreshCaptcha: true, fieldPath: "password", message: formErrorCopy[error.code] };
  }
  if (error.fields.length > 0) {
    return {
      refreshCaptcha: true,
      payload: { error: { code: error.code, fields: [...error.fields] } },
    };
  }
  return { refreshCaptcha: true, message: formErrorCopy[error.code] };
}

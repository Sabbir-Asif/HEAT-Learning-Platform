import { ApiError } from "@heat/api-client";
import { formErrorCopy, genericFormMessage, rateLimitedMessage } from "@heat/ui";
import { describe, expect, test } from "vitest";
import { classifySubmitError } from "../../src/enroll/submit-error";

const failure = (
  code: ApiError["code"],
  extra: Partial<ConstructorParameters<typeof ApiError>[0]> = {},
) => new ApiError({ status: 400, code, ...extra });

describe("classifySubmitError", () => {
  test.each(["CAPTCHA_INVALID", "CAPTCHA_EXPIRED"] as const)(
    "puts %s on the captcha field and asks for a new image",
    (code) => {
      expect(classifySubmitError(failure(code))).toEqual({
        refreshCaptcha: true,
        fieldPath: "captchaAnswer",
        message: formErrorCopy[code],
      });
    },
  );

  test("puts a breached password on the password field and asks for a new image", () => {
    expect(classifySubmitError(failure("PASSWORD_BREACHED"))).toEqual({
      refreshCaptcha: true,
      fieldPath: "password",
      message: formErrorCopy.PASSWORD_BREACHED,
    });
  });

  test("shows the retry time on a rate limit and keeps the captcha", () => {
    expect(
      classifySubmitError(failure("RATE_LIMITED", { status: 429, retryAfterSeconds: 90 })),
    ).toEqual({ refreshCaptcha: false, message: rateLimitedMessage(90) });
  });

  test.each(["NETWORK_ERROR", "REQUEST_ABORTED"] as const)("keeps the captcha on %s", (code) => {
    expect(classifySubmitError(failure(code))).toEqual({
      refreshCaptcha: false,
      message: formErrorCopy[code],
    });
  });

  test("hands server field errors to the form", () => {
    const fields = [{ path: "email", code: "invalid_format" as const }];
    expect(classifySubmitError(failure("VALIDATION_FAILED", { fields }))).toEqual({
      refreshCaptcha: true,
      payload: { error: { code: "VALIDATION_FAILED", fields } },
    });
  });

  test("shows the copy of any other code", () => {
    expect(classifySubmitError(failure("INTERNAL", { status: 500 }))).toEqual({
      refreshCaptcha: true,
      message: formErrorCopy.INTERNAL,
    });
  });

  test("shows the generic message for something that is not an API error", () => {
    expect(classifySubmitError(new Error("boom"))).toEqual({
      refreshCaptcha: false,
      message: genericFormMessage,
    });
  });
});

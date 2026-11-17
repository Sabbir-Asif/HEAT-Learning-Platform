import { ApiError } from "@heat/api-client";
import { describe, expect, test } from "vitest";
import {
  classifyPasswordFailure,
  wrongCurrentPasswordMessage,
} from "../../src/profile/password-failure";

const failure = (code: ApiError["code"], status = 400, retryAfterSeconds?: number) =>
  classifyPasswordFailure(new ApiError({ status, code, retryAfterSeconds }));

describe("classifyPasswordFailure", () => {
  test("points a wrong current password at its field", () => {
    expect(failure("INVALID_CREDENTIALS")).toEqual({
      field: "currentPassword",
      message: wrongCurrentPasswordMessage,
    });
  });

  test("points a wrong or expired code at the code field", () => {
    expect(failure("PASSWORD_CODE_INVALID").field).toBe("code");
    const expired = failure("PASSWORD_CODE_EXPIRED", 410);
    expect(expired.field).toBe("code");
    expect(expired.message).toContain("Request a new one");
  });

  test("points a breached password at the new password field with a clear message", () => {
    const breached = failure("PASSWORD_BREACHED");
    expect(breached.field).toBe("newPassword");
    expect(breached.message).toContain("data breach");
  });

  test("shows a rate limit as a form message with the wait", () => {
    const limited = failure("RATE_LIMITED", 429, 120);
    expect(limited.field).toBeUndefined();
    expect(limited.message).toContain("2 minutes");
  });

  test("falls back to the generic message for anything else", () => {
    expect(classifyPasswordFailure(new Error("boom")).field).toBeUndefined();
    expect(failure("PASSWORD_CODE_EMAIL_UNVERIFIED", 403).message).toContain("Verify your email");
  });
});

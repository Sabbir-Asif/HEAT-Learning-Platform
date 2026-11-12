import { ApiError } from "@heat/api-client";
import { describe, expect, test } from "vitest";
import { classifyResetFailure } from "../../src/password-reset/reset-failure";

const failure = (code: ConstructorParameters<typeof ApiError>[0]["code"], status = 400) =>
  classifyResetFailure(new ApiError({ status, code }));

describe("classifyResetFailure", () => {
  test("maps the three link codes to one link failure", () => {
    expect(failure("RESET_LINK_USED", 409)).toEqual({ kind: "link" });
    expect(failure("RESET_LINK_EXPIRED", 410)).toEqual({ kind: "link" });
    expect(failure("RESET_LINK_INVALID", 404)).toEqual({ kind: "link" });
  });

  test("flags a breached password for the password field", () => {
    expect(failure("PASSWORD_BREACHED")).toMatchObject({ kind: "breached" });
  });

  test("offers a retry for rate limits and non API errors", () => {
    expect(failure("RATE_LIMITED", 429)).toMatchObject({ kind: "retry" });
    expect(classifyResetFailure(new Error("boom"))).toMatchObject({ kind: "retry" });
  });
});

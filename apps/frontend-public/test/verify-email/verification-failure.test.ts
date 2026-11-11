import { ApiError } from "@heat/api-client";
import { describe, expect, test } from "vitest";
import { classifyVerificationFailure } from "../../src/verify-email/verification-failure";

const failure = (code: ConstructorParameters<typeof ApiError>[0]["code"], status = 400) =>
  classifyVerificationFailure(new ApiError({ status, code }));

describe("classifyVerificationFailure", () => {
  test("maps the three link codes", () => {
    expect(failure("VERIFICATION_LINK_USED", 409)).toEqual({ kind: "used" });
    expect(failure("VERIFICATION_LINK_EXPIRED", 410)).toEqual({ kind: "expired" });
    expect(failure("VERIFICATION_LINK_INVALID", 404)).toEqual({ kind: "invalid" });
  });

  test("offers a retry with a message for rate limits and network failures", () => {
    expect(failure("RATE_LIMITED", 429)).toMatchObject({ kind: "retry" });
    expect(failure("NETWORK_ERROR", 0)).toMatchObject({ kind: "retry" });
  });

  test("offers a retry for anything that is not an API error", () => {
    expect(classifyVerificationFailure(new Error("boom"))).toMatchObject({ kind: "retry" });
  });
});

import { describe, expect, test } from "vitest";
import {
  decodeCertificateNumber,
  isNotFoundFailure,
  isRateLimitedFailure,
  toVerificationModel,
  visitorAddressHeaders,
} from "../../src/verify/verification-view";

const headersOf = (entries: Record<string, string>) => new Headers(entries);

const verification = {
  status: "VALID" as const,
  holderName: "Rahim Uddin",
  courseTitle: "HEAT Gender Safety",
  completedAt: "2026-11-10T20:00:00.000Z",
};

describe("verification view model", () => {
  test("a valid certificate shows name, course and the Dhaka completion date only", () => {
    const model = toVerificationModel(verification, "ABCD-EFGH-JKMN");

    expect(model.valid).toBe(true);
    expect(model.heading).toBe("This certificate is valid");
    expect(model.rows).toEqual([
      { label: "Name", value: "Rahim Uddin" },
      { label: "Course", value: "HEAT Gender Safety" },
      { label: "Completed", value: "11 November 2026" },
    ]);
  });

  test("a revoked certificate is never presented as valid", () => {
    const model = toVerificationModel({ ...verification, status: "REVOKED" }, "ABCD-EFGH-JKMN");

    expect(model.valid).toBe(false);
    expect(model.heading).toBe("This certificate was revoked");
    expect(model.note).toContain("no longer valid");
  });

  test("only a NOT_FOUND failure counts as not found", () => {
    expect(isNotFoundFailure({ code: "NOT_FOUND" })).toBe(true);
    expect(isNotFoundFailure({ code: "RATE_LIMITED" })).toBe(false);
    expect(isNotFoundFailure(new Error("x"))).toBe(false);
    expect(isNotFoundFailure(null)).toBe(false);
  });
});

describe("visitorAddressHeaders", () => {
  test("forwards the address the proxy reported as the single hop the API trusts", () => {
    expect(visitorAddressHeaders(headersOf({ "x-real-ip": "203.0.113.7" }))).toEqual({
      "x-forwarded-for": "203.0.113.7",
    });
  });

  test("falls back to the last forwarded address, which the proxy wrote", () => {
    expect(
      visitorAddressHeaders(headersOf({ "x-forwarded-for": "198.51.100.1, 203.0.113.9" })),
    ).toEqual({ "x-forwarded-for": "203.0.113.9" });
  });

  test("accepts an IPv6 address", () => {
    expect(visitorAddressHeaders(headersOf({ "x-real-ip": "2001:db8::1" }))).toEqual({
      "x-forwarded-for": "2001:db8::1",
    });
  });

  test("forwards nothing when there is no usable address", () => {
    expect(visitorAddressHeaders(headersOf({}))).toEqual({});
    expect(visitorAddressHeaders(headersOf({ "x-real-ip": "not-an-ip" }))).toEqual({});
  });
});

describe("decodeCertificateNumber", () => {
  test("decodes, trims and upper-cases the number", () => {
    expect(decodeCertificateNumber(" abcd-efgh%20")).toBe("ABCD-EFGH");
  });

  test("returns null for a malformed escape", () => {
    expect(decodeCertificateNumber("%E0%A4%A")).toBeNull();
  });
});

describe("isRateLimitedFailure", () => {
  test("recognises the rate limited error code only", () => {
    expect(isRateLimitedFailure({ code: "RATE_LIMITED" })).toBe(true);
    expect(isRateLimitedFailure({ code: "NOT_FOUND" })).toBe(false);
    expect(isRateLimitedFailure(new Error("x"))).toBe(false);
  });
});

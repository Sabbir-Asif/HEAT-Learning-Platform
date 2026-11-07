import { describe, expect, test } from "vitest";
import { clientErrorCodes, errorCodes, errorResponseSchema } from "../src/index";

const publishedCodes = [
  "BAD_REQUEST",
  "FORBIDDEN",
  "INTERNAL",
  "NOT_FOUND",
  "RATE_LIMITED",
  "UNAUTHENTICATED",
  "VALIDATION_FAILED",
];
const publishedClientCodes = ["NETWORK_ERROR", "REQUEST_ABORTED", "UNEXPECTED_RESPONSE"];

describe("error codes", () => {
  test("every published API code is still present", () => {
    expect(errorCodes).toEqual(expect.arrayContaining(publishedCodes));
  });

  test("every published client code is still present", () => {
    expect(clientErrorCodes).toEqual(expect.arrayContaining(publishedClientCodes));
  });

  test("codes are unique upper snake case, and no code is shared by API and client", () => {
    const all = [...errorCodes, ...clientErrorCodes];
    expect(new Set(all).size).toBe(all.length);
    expect(all.filter((code) => !/^[A-Z][A-Z_]*[A-Z]$/.test(code))).toEqual([]);
  });
});

describe("errorResponseSchema", () => {
  const base = { code: "NOT_FOUND", message: "Not found", requestId: "req-1" };

  test("accepts an envelope without fields", () => {
    expect(errorResponseSchema.parse({ error: base })).toEqual({ error: base });
  });

  test("accepts per-field errors with dotted paths", () => {
    const body = {
      error: { ...base, code: "VALIDATION_FAILED", fields: [{ path: "a.0.b", code: "too_small" }] },
    };
    expect(errorResponseSchema.parse(body)).toEqual(body);
  });

  test("rejects a code outside the closed list", () => {
    expect(errorResponseSchema.safeParse({ error: { ...base, code: "TEAPOT" } }).success).toBe(
      false,
    );
  });

  test("rejects a client-only code, which the API never sends", () => {
    expect(
      errorResponseSchema.safeParse({ error: { ...base, code: "NETWORK_ERROR" } }).success,
    ).toBe(false);
  });

  test("rejects a body without the error wrapper", () => {
    expect(errorResponseSchema.safeParse(base).success).toBe(false);
  });
});

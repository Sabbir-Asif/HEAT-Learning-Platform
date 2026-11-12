import { describe, expect, test } from "vitest";
import { decideRevalidation, secretMatches } from "../../src/revalidate/revalidate-auth";

const secret = "s".repeat(40);

const decide = (overrides: {
  expectedSecret?: string | undefined;
  providedSecret?: string | null;
  headers?: Record<string, string>;
}) =>
  decideRevalidation({
    expectedSecret: "expectedSecret" in overrides ? overrides.expectedSecret : secret,
    providedSecret: "providedSecret" in overrides ? (overrides.providedSecret ?? null) : secret,
    headers: new Headers(overrides.headers),
  });

describe("secretMatches", () => {
  test("matches only the identical secret, whatever the length", () => {
    expect(secretMatches(secret, secret)).toBe(true);
    expect(secretMatches(secret, `${secret}x`)).toBe(false);
    expect(secretMatches(secret, "s")).toBe(false);
    expect(secretMatches(secret, null)).toBe(false);
  });
});

describe("decideRevalidation", () => {
  test("allows the right secret on an internal call", () => {
    expect(decide({})).toEqual({ kind: "allowed" });
  });

  test("refuses a missing or wrong secret with 401", () => {
    expect(decide({ providedSecret: null })).toEqual({ kind: "refused", status: 401 });
    expect(decide({ providedSecret: "wrong" })).toEqual({ kind: "refused", status: 401 });
  });

  test("refuses with 503 when no secret is configured", () => {
    expect(decide({ expectedSecret: undefined })).toEqual({ kind: "refused", status: 503 });
    expect(decide({ expectedSecret: "" })).toEqual({ kind: "refused", status: 503 });
  });

  test.each(["x-forwarded-for", "x-real-ip", "forwarded"])(
    "refuses a call that came through the proxy (%s) even with the secret",
    (header) => {
      expect(decide({ headers: { [header]: "203.0.113.9" } })).toEqual({
        kind: "refused",
        status: 403,
      });
    },
  );
});

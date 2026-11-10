import { describe, expect, test } from "vitest";
import { clientErrorCodes, errorCodes, fieldErrorCodes } from "../../contracts/src/errors";
import {
  fieldErrorCopy,
  formErrorCopy,
  genericFormMessage,
  rateLimitedMessage,
  toFormErrors,
} from "../src/composites/form-errors";

const validation = (fields: { path: string; code: string }[]) => ({
  error: { code: "VALIDATION_FAILED", message: "x", requestId: "r", fields },
});

describe("copy", () => {
  test("every field error code has English text", () => {
    for (const code of Object.keys(fieldErrorCopy)) {
      expect(fieldErrorCopy[code as keyof typeof fieldErrorCopy].length).toBeGreaterThan(0);
    }
    expect(Object.keys(fieldErrorCopy).sort()).toEqual([
      "custom",
      "invalid",
      "invalid_format",
      "invalid_type",
      "invalid_value",
      "required",
      "too_big",
      "too_small",
      "unrecognized_keys",
    ]);
  });

  test("rate limits and network failures have their own form-level text", () => {
    expect(formErrorCopy.RATE_LIMITED).not.toBe(formErrorCopy.NETWORK_ERROR);
    expect(formErrorCopy.RATE_LIMITED).not.toBe(genericFormMessage);
  });
});

describe("copy against the shared contract", () => {
  test("has text for exactly the field error codes", () => {
    expect(Object.keys(fieldErrorCopy).sort()).toEqual([...fieldErrorCodes].sort());
  });

  test("has form-level text for exactly the error codes and client error codes", () => {
    expect(Object.keys(formErrorCopy).sort()).toEqual([...errorCodes, ...clientErrorCodes].sort());
  });
});

describe("toFormErrors", () => {
  test("maps a known path to its field with the copy for its code", () => {
    const result = toFormErrors(validation([{ path: "email", code: "required" }]), ["email"]);
    expect(result.fields).toEqual([{ path: "email", message: fieldErrorCopy.required }]);
    expect(result.formMessage).toBeUndefined();
  });

  test("matches nested and array paths written with dots", () => {
    const result = toFormErrors(
      validation([
        { path: "address.street", code: "too_small" },
        { path: "items.0.name", code: "invalid" },
      ]),
      ["address.street", "items.0.name"],
    );
    expect(result.fields.map((field) => field.path)).toEqual(["address.street", "items.0.name"]);
  });

  test("sends an unknown path to one form-level message without the path or code", () => {
    const result = toFormErrors(
      validation([
        { path: "ghost", code: "custom" },
        { path: "other", code: "invalid" },
      ]),
      ["email"],
    );
    expect(result.fields).toEqual([]);
    expect(result.formMessage).toBe(genericFormMessage);
    expect(result.formMessage).not.toMatch(/ghost|custom/);
  });

  test("keeps matched fields and adds the form-level message for the rest", () => {
    const result = toFormErrors(
      validation([
        { path: "email", code: "required" },
        { path: "ghost", code: "custom" },
      ]),
      ["email"],
    );
    expect(result.fields).toHaveLength(1);
    expect(result.formMessage).toBe(genericFormMessage);
  });

  test("shows only the first error for a repeated path", () => {
    const result = toFormErrors(
      validation([
        { path: "email", code: "required" },
        { path: "email", code: "invalid" },
      ]),
      ["email"],
    );
    expect(result.fields).toEqual([{ path: "email", message: fieldErrorCopy.required }]);
  });

  test("uses form-level text by code when there are no fields", () => {
    for (const code of ["RATE_LIMITED", "FORBIDDEN", "UNAUTHENTICATED", "INTERNAL"] as const) {
      const result = toFormErrors({ error: { code, message: "x", requestId: "r" } }, []);
      expect(result.fields).toEqual([]);
      expect(result.formMessage).toBe(formErrorCopy[code]);
    }
  });

  test("uses client error codes too", () => {
    const result = toFormErrors({ error: { code: "NETWORK_ERROR", message: "x" } }, []);
    expect(result.formMessage).toBe(formErrorCopy.NETWORK_ERROR);
  });

  test("never shows the server's own message", () => {
    const result = toFormErrors(
      { error: { code: "INTERNAL", message: "secret stack", requestId: "r" } },
      [],
    );
    expect(result.formMessage).not.toContain("secret");
  });

  test.each([null, undefined, 42, "text", {}, { error: null }, { error: { code: 5 } }])(
    "gives the generic message for a payload that is not an error response: %j",
    (payload) => {
      const result = toFormErrors(payload, ["email"]);
      expect(result.fields).toEqual([]);
      expect(result.formMessage).toBe(genericFormMessage);
    },
  );

  test("treats an unknown field code as invalid", () => {
    const result = toFormErrors(validation([{ path: "email", code: "brand_new" }]), ["email"]);
    expect(result.fields).toEqual([{ path: "email", message: fieldErrorCopy.invalid }]);
  });
});

describe("rateLimitedMessage", () => {
  test("falls back to the generic text without a wait", () => {
    expect(rateLimitedMessage()).toBe(formErrorCopy.RATE_LIMITED);
    expect(rateLimitedMessage(0)).toBe(formErrorCopy.RATE_LIMITED);
  });

  test("names seconds under a minute and minutes from a minute up, rounding up", () => {
    expect(rateLimitedMessage(1)).toBe("Too many attempts. Try again in 1 second.");
    expect(rateLimitedMessage(45)).toBe("Too many attempts. Try again in 45 seconds.");
    expect(rateLimitedMessage(60)).toBe("Too many attempts. Try again in 1 minute.");
    expect(rateLimitedMessage(61)).toBe("Too many attempts. Try again in 2 minutes.");
    expect(rateLimitedMessage(900)).toBe("Too many attempts. Try again in 15 minutes.");
  });
});

import { describe, expect, test } from "vitest";
import {
  attemptsKey,
  generatePasswordCode,
  passwordCodeExpiry,
  passwordCodeMatches,
  remainingSeconds,
  sealPasswordCode,
} from "../../src/me/password-code";

describe("generatePasswordCode", () => {
  test("always returns six digits, keeping leading zeros", () => {
    for (let index = 0; index < 200; index += 1) {
      expect(generatePasswordCode()).toMatch(/^\d{6}$/);
    }
  });
});

describe("sealPasswordCode and passwordCodeMatches", () => {
  test("accepts the right code and refuses a different one", () => {
    const stored = sealPasswordCode("012345");
    expect(passwordCodeMatches(stored, "012345")).toBe(true);
    expect(passwordCodeMatches(stored, "012346")).toBe(false);
  });

  test("does not store the code and salts every seal differently", () => {
    const first = sealPasswordCode("123456");
    const second = sealPasswordCode("123456");
    expect(first).not.toContain("123456");
    expect(first).not.toBe(second);
  });

  test("refuses a malformed stored value", () => {
    expect(passwordCodeMatches("nodot", "123456")).toBe(false);
    expect(passwordCodeMatches("salt.zz", "123456")).toBe(false);
  });
});

describe("expiry and attempts", () => {
  test("expires fifteen minutes after issue", () => {
    const now = new Date("2026-11-12T10:00:00Z");
    expect(passwordCodeExpiry(now).toISOString()).toBe("2026-11-12T10:15:00.000Z");
  });

  test("never reports less than one second remaining", () => {
    const now = new Date("2026-11-12T10:00:00Z");
    expect(remainingSeconds(new Date("2026-11-12T10:00:30Z"), now)).toBe(30);
    expect(remainingSeconds(new Date("2026-11-12T09:00:00Z"), now)).toBe(1);
  });

  test("keys attempts by code", () => {
    expect(attemptsKey("abc")).toBe("password-code:attempts:abc");
  });
});

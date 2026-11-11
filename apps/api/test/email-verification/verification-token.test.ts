import { describe, expect, test } from "vitest";
import { classifyToken, verificationExpiry } from "../../src/email-verification/verification-token";

const now = new Date("2026-11-10T00:00:00.000Z");
const hours = (count: number) => count * 3_600_000;

describe("verificationExpiry", () => {
  test("uses the ttl when the registration window is far away", () => {
    const registeredAt = new Date(now.getTime() - hours(1));

    expect(verificationExpiry(now, registeredAt, 48)).toEqual(new Date(now.getTime() + hours(48)));
  });

  test("never outlives the seven day registration window", () => {
    const registeredAt = new Date(now.getTime() - hours(24 * 7 - 5));

    expect(verificationExpiry(now, registeredAt, 48)).toEqual(new Date(now.getTime() + hours(5)));
  });

  test("is already past once the registration window has closed", () => {
    const registeredAt = new Date(now.getTime() - hours(24 * 8));

    expect(verificationExpiry(now, registeredAt, 48).getTime()).toBeLessThan(now.getTime());
  });
});

describe("classifyToken", () => {
  const live = { purpose: "VERIFY_EMAIL", usedAt: null, expiresAt: new Date(now.getTime() + 1000) };

  test("an unknown token is invalid", () => {
    expect(classifyToken(null, now)).toBe("invalid");
  });

  test("a token of another purpose is invalid", () => {
    expect(classifyToken({ ...live, purpose: "INVITE" }, now)).toBe("invalid");
  });

  test("a used token is used, even when it has also expired", () => {
    expect(classifyToken({ ...live, usedAt: now }, now)).toBe("used");
    expect(
      classifyToken({ ...live, usedAt: now, expiresAt: new Date(now.getTime() - 1) }, now),
    ).toBe("used");
  });

  test("an unused token past its expiry is expired, and the boundary counts as expired", () => {
    expect(classifyToken({ ...live, expiresAt: new Date(now.getTime() - 1) }, now)).toBe("expired");
    expect(classifyToken({ ...live, expiresAt: now }, now)).toBe("expired");
  });

  test("a live token that lost the claim race is treated as used", () => {
    expect(classifyToken(live, now)).toBe("used");
  });
});

import { describe, expect, test } from "vitest";
import {
  PASSWORD_RESET_EMAIL_CAP,
  capWindowStart,
  classifyResetToken,
  emailCapReached,
  resetExpiry,
} from "../../src/password-reset/password-reset-rules";

const now = new Date("2026-11-10T00:00:00.000Z");

describe("resetExpiry", () => {
  test("adds the lifetime in minutes", () => {
    expect(resetExpiry(now, 60)).toEqual(new Date("2026-11-10T01:00:00.000Z"));
  });
});

describe("emailCapReached", () => {
  test("allows requests below the cap and blocks at it", () => {
    expect(emailCapReached(PASSWORD_RESET_EMAIL_CAP - 1)).toBe(false);
    expect(emailCapReached(PASSWORD_RESET_EMAIL_CAP)).toBe(true);
  });

  test("counts requests from the last hour", () => {
    expect(capWindowStart(now)).toEqual(new Date("2026-11-09T23:00:00.000Z"));
  });
});

describe("classifyResetToken", () => {
  const live = { purpose: "RESET_PASSWORD", usedAt: null, expiresAt: new Date(now.getTime() + 1) };

  test("an unknown token or another purpose is invalid", () => {
    expect(classifyResetToken(null, now)).toBe("invalid");
    expect(classifyResetToken({ ...live, purpose: "VERIFY_EMAIL" }, now)).toBe("invalid");
  });

  test("a consumed token is used", () => {
    expect(classifyResetToken({ ...live, usedAt: now }, now)).toBe("used");
  });

  test("a lapsed token is expired", () => {
    expect(classifyResetToken({ ...live, expiresAt: now }, now)).toBe("expired");
  });

  test("a live token that lost the claim race is used", () => {
    expect(classifyResetToken(live, now)).toBe("used");
  });
});

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { loadConfig, rateLimitProfileNames } from "../../src/core/config";
import { rateLimitEnvName } from "../../src/core/config/rate-limit-config";

const valid = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  AUTH_ACCESS_SECRET: "x".repeat(32),
  AUTH_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
};

describe("loadConfig", () => {
  test("applies the documented defaults", () => {
    const config = loadConfig(valid);
    expect(config.auth).toMatchObject({
      accessTokenTtlSeconds: 600,
      refreshTokenTtlDays: 30,
      adminIdleMinutes: 30,
      refreshGraceSeconds: 20,
    });
    expect(config.argon2).toEqual({ memoryCost: 19456, timeCost: 2, parallelism: 1 });
    expect(config.auth.encryptionKey).toHaveLength(32);
  });

  test("reads overrides as numbers", () => {
    expect(loadConfig({ ...valid, ADMIN_IDLE_MINUTES: "5" }).auth.adminIdleMinutes).toBe(5);
  });

  test("refuses a short access secret without echoing its value", () => {
    expect(() => loadConfig({ ...valid, AUTH_ACCESS_SECRET: "short" })).toThrow(
      "Invalid environment configuration: AUTH_ACCESS_SECRET",
    );
  });

  test("refuses an encryption key that is not 32 bytes", () => {
    expect(() => loadConfig({ ...valid, AUTH_ENCRYPTION_KEY: "AAAA" })).toThrow(
      /AUTH_ENCRYPTION_KEY/,
    );
  });

  test("refuses missing secrets", () => {
    expect(() => loadConfig({})).toThrow(/AUTH_ACCESS_SECRET/);
  });
});

describe("loadConfig rate limits", () => {
  test("applies profile and lockout defaults", () => {
    const { rateLimit } = loadConfig(valid);
    expect(rateLimit.profiles.signIn).toEqual({ limit: 10, windowSeconds: 900, ipLimit: 1000 });
    expect(rateLimit.lockout).toEqual({
      threshold: 5,
      baseSeconds: 30,
      maxSeconds: 900,
      memorySeconds: 3600,
    });
  });

  test("reads profile overrides from derived variable names", () => {
    const { rateLimit } = loadConfig({
      ...valid,
      RATE_LIMIT_RESEND_VERIFICATION_LIMIT: "7",
      RATE_LIMIT_SIGN_IN_IP_LIMIT: "50",
      LOCKOUT_THRESHOLD: "3",
    });
    expect(rateLimit.profiles.resendVerification.limit).toBe(7);
    expect(rateLimit.profiles.signIn.ipLimit).toBe(50);
    expect(rateLimit.lockout.threshold).toBe(3);
  });

  test("names every invalid variable without echoing values", () => {
    expect(() =>
      loadConfig({ ...valid, LOCKOUT_BASE_SECONDS: "abc", RATE_LIMIT_CAPTCHA_LIMIT: "0" }),
    ).toThrow("Invalid environment configuration: RATE_LIMIT_CAPTCHA_LIMIT, LOCKOUT_BASE_SECONDS");
  });

  test("every variable is documented in .env.example", () => {
    const example = readFileSync(join(__dirname, "../../.env.example"), "utf8");
    for (const profile of rateLimitProfileNames) {
      for (const field of ["LIMIT", "WINDOW_SECONDS", "IP_LIMIT"]) {
        expect(example).toContain(`${rateLimitEnvName(profile, field)}=`);
      }
    }
    expect(example).toContain("LOCKOUT_THRESHOLD=");
  });
});

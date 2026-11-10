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
  CSRF_SECRET: "c".repeat(32),
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

  test("defaults the invitation lifetime and admin app URL, and reads overrides", () => {
    expect(loadConfig(valid).invitations).toEqual({
      ttlHours: 72,
      adminAppUrl: "http://localhost:3001",
    });
    expect(
      loadConfig({
        ...valid,
        ADMIN_INVITE_TTL_HOURS: "24",
        ADMIN_APP_URL: "https://admin.example.test",
      }).invitations,
    ).toEqual({ ttlHours: 24, adminAppUrl: "https://admin.example.test" });
  });

  test("refuses an admin app URL with a path, and requires it in production", () => {
    expect(() => loadConfig({ ...valid, ADMIN_APP_URL: "https://admin.example.test/app" })).toThrow(
      /ADMIN_APP_URL/,
    );
    expect(() =>
      loadConfig({ ...valid, NODE_ENV: "production", TRUSTED_ORIGINS: "https://a.example.test" }),
    ).toThrow(/ADMIN_APP_URL/);
  });

  test("reads overrides as numbers", () => {
    expect(loadConfig({ ...valid, ADMIN_IDLE_MINUTES: "5" }).auth.adminIdleMinutes).toBe(5);
  });

  test("refuses a short access secret without echoing its value", () => {
    expect(() => loadConfig({ ...valid, AUTH_ACCESS_SECRET: "short" })).toThrow(
      "Invalid environment configuration: AUTH_ACCESS_SECRET",
    );
  });

  test("refuses a short CSRF secret without echoing its value", () => {
    expect(() => loadConfig({ ...valid, CSRF_SECRET: "short" })).toThrow(
      "Invalid environment configuration: CSRF_SECRET",
    );
  });

  test("reads trusted origins as a list and defaults to the local apps", () => {
    expect(loadConfig(valid).csrf.trustedOrigins).toEqual([
      "http://localhost:3000",
      "http://localhost:3001",
    ]);
    expect(
      loadConfig({
        ...valid,
        TRUSTED_ORIGINS: "https://learn.example.test, https://admin.example.test",
      }).csrf.trustedOrigins,
    ).toEqual(["https://learn.example.test", "https://admin.example.test"]);
  });

  test("requires trusted origins in production instead of defaulting to local apps", () => {
    expect(() => loadConfig({ ...valid, NODE_ENV: "production" })).toThrow(/TRUSTED_ORIGINS/);
    expect(() => loadConfig({ ...valid, NODE_ENV: "production", TRUSTED_ORIGINS: " , " })).toThrow(
      /TRUSTED_ORIGINS/,
    );
    expect(
      loadConfig({
        ...valid,
        NODE_ENV: "production",
        TRUSTED_ORIGINS: "https://learn.example.test",
        ADMIN_APP_URL: "https://admin.example.test",
      }).csrf.trustedOrigins,
    ).toEqual(["https://learn.example.test"]);
  });

  test("keeps the local defaults in development and test", () => {
    for (const NODE_ENV of ["development", "test"]) {
      expect(loadConfig({ ...valid, NODE_ENV }).csrf.trustedOrigins).toEqual([
        "http://localhost:3000",
        "http://localhost:3001",
      ]);
    }
  });

  test("refuses a trusted origin that carries a path", () => {
    expect(() => loadConfig({ ...valid, TRUSTED_ORIGINS: "https://a.test/x" })).toThrow(
      /TRUSTED_ORIGINS/,
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
      accountThreshold: 50,
    });
    expect(rateLimit.redisTimeoutMs).toBe(200);
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
    expect(example).toContain("CSRF_SECRET=");
    expect(example).toContain("TRUSTED_ORIGINS=");
  });
});

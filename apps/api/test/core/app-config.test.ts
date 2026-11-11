import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { loadConfig, rateLimitProfileNames } from "../../src/core/config";
import { rateLimitEnvName } from "../../src/core/config/rate-limit-config";

const productionMail = {
  SMTP_HOST: "smtp.gmail.com",
  SMTP_FROM_ADDRESS: "sender@example.test",
  SMTP_USER: "sender@example.test",
  SMTP_PASSWORD: "app-password-value",
};

const valid = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  AUTH_ACCESS_SECRET: "access-secret-0123456789-abcdefghijklmnop",
  AUTH_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  CSRF_SECRET: "csrf-secret-0123456789-abcdefghijklmnopqrs",
};

describe("loadConfig", () => {
  test("applies the documented defaults", () => {
    const config = loadConfig(valid);
    expect(config.auth).toMatchObject({
      accessTokenTtlSeconds: 600,
      refreshTokenTtlDays: 30,
      adminIdleMinutes: 30,
      refreshGraceSeconds: 20,
      adminSessionAbsoluteHours: 12,
      studentSessionAbsoluteDays: 30,
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
    expect(loadConfig(valid).audit).toEqual({
      transactionMaxWaitMs: 5000,
      transactionTimeoutMs: 15000,
    });
    expect(
      loadConfig({ ...valid, AUDIT_TRANSACTION_TIMEOUT_MS: "20000" }).audit.transactionTimeoutMs,
    ).toBe(20000);
    expect(loadConfig({ ...valid, ADMIN_IDLE_MINUTES: "5" }).auth.adminIdleMinutes).toBe(5);
  });

  test("defaults the registration response floor to one second and reads an override", () => {
    expect(loadConfig(valid).accountProtection).toEqual({ responseFloorMs: 1000 });
    expect(
      loadConfig({ ...valid, RESPONSE_FLOOR_MS: "1500" }).accountProtection.responseFloorMs,
    ).toBe(1500);
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

  test.each(["AUTH_ACCESS_SECRET", "CSRF_SECRET"])(
    "%s must be 32 characters or more and not low entropy",
    (name) => {
      const reject = (value: string) =>
        expect(() => loadConfig({ ...valid, [name]: value })).toThrow(
          `Invalid environment configuration: ${name}`,
        );
      reject("a".repeat(31));
      reject("a".repeat(64));
      reject("ab".repeat(20));
      reject("abcdefgh".repeat(6));
      expect(() =>
        loadConfig({ ...valid, [name]: "Zq7mP2vK9wL4xR8tN3bH6cD1fG5jS0yE" }),
      ).not.toThrow();
    },
  );

  test("reads trusted origins as a list and defaults to the local apps", () => {
    expect(loadConfig(valid).csrf.trustedOrigins).toEqual([
      "http://localhost:3000",
      "http://localhost:3001",
      "http://learn.localhost",
      "http://admin.localhost",
    ]);
    expect(
      loadConfig({
        ...valid,
        TRUSTED_ORIGINS: "https://learn.example.test, https://admin.example.test",
      }).csrf.trustedOrigins,
    ).toEqual(["https://learn.example.test", "https://admin.example.test"]);
  });

  test("requires trusted origins in production instead of defaulting to local apps", () => {
    const production = { ...valid, ...productionMail, NODE_ENV: "production" };
    expect(() => loadConfig(production)).toThrow(/TRUSTED_ORIGINS/);
    expect(() => loadConfig({ ...production, TRUSTED_ORIGINS: " , " })).toThrow(/TRUSTED_ORIGINS/);
    expect(
      loadConfig({
        ...valid,
        ...productionMail,
        NODE_ENV: "production",
        TRUSTED_ORIGINS: "https://learn.example.test",
        ADMIN_APP_URL: "https://admin.example.test",
      }).csrf.trustedOrigins,
    ).toEqual(["https://learn.example.test"]);
  });

  test("exposes the mail configuration and defaults it to the local Mailpit", () => {
    expect(loadConfig(valid).mail).toMatchObject({ host: "localhost", port: 1035, auth: null });
    expect(() => loadConfig({ ...valid, SMTP_TLS: "ssl" })).toThrow(/SMTP_TLS/);
  });

  test("keeps the local defaults in development and test", () => {
    for (const NODE_ENV of ["development", "test"]) {
      expect(loadConfig({ ...valid, NODE_ENV }).csrf.trustedOrigins).toEqual([
        "http://localhost:3000",
        "http://localhost:3001",
        "http://learn.localhost",
        "http://admin.localhost",
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

  test("the directory lookup profile is per IP only, so only its IP ceiling is read", () => {
    const { rateLimit } = loadConfig({
      ...valid,
      RATE_LIMIT_DIRECTORY_LOOKUP_LIMIT: "abc",
      RATE_LIMIT_DIRECTORY_LOOKUP_WINDOW_SECONDS: "0",
      RATE_LIMIT_DIRECTORY_LOOKUP_IP_LIMIT: "4000",
    });
    expect(rateLimit.profiles.directoryLookup.ipLimit).toBe(4000);
    expect(rateLimit.profiles.directoryLookup.limit).toBe(600);
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
        const ipOnly = profile === "directoryLookup" && field !== "IP_LIMIT";
        const name = `${rateLimitEnvName(profile, field)}=`;
        if (ipOnly) expect(example).not.toContain(name);
        else expect(example).toContain(name);
      }
    }
    expect(example).toContain("LOCKOUT_THRESHOLD=");
    expect(example).toContain("CSRF_SECRET=");
    expect(example).toContain("TRUSTED_ORIGINS=");
  });
});

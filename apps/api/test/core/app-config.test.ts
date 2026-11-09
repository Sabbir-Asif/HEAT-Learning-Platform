import { randomBytes } from "node:crypto";
import { describe, expect, test } from "vitest";
import { loadConfig } from "../../src/core/config";

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

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { loadConfig, rateLimitProfileNames } from "../../src/core/config";
import { rateLimitEnvName } from "../../src/core/config/rate-limit-config";

const productionMail = {
  SMTP_HOST: "smtp.gmail.com",
  SMTP_PORT: "587",
  SMTP_TLS: "starttls",
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

  test("defaults the verification token lifetime to 48 hours and reads an override", () => {
    expect(loadConfig(valid).verification).toEqual({ tokenTtlHours: 48 });
    expect(loadConfig({ ...valid, VERIFICATION_TOKEN_TTL_HOURS: "12" }).verification).toEqual({
      tokenTtlHours: 12,
    });
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
        VIDEO_UPLOAD_DIR: "/srv/heat/uploads",
        MEDIA_STORAGE_DIR: "/srv/heat/media/files",
        HLS_MEDIA_DIR: "/srv/heat/media/hls",
      }).csrf.trustedOrigins,
    ).toEqual(["https://learn.example.test"]);
  });

  test("exposes the public app origin with a local default and rejects a path", () => {
    expect(loadConfig(valid).publicAppUrl).toBe("http://localhost:3000");
    expect(
      loadConfig({ ...valid, PUBLIC_APP_URL: "https://learn.example.test" }).publicAppUrl,
    ).toBe("https://learn.example.test");
    expect(() =>
      loadConfig({ ...valid, PUBLIC_APP_URL: "https://learn.example.test/app" }),
    ).toThrow(/PUBLIC_APP_URL/);
  });

  test("exposes the revalidation target with a local default, an optional secret and rejects a path", () => {
    expect(loadConfig(valid).revalidation).toEqual({
      url: "http://localhost:3000",
      secret: undefined,
    });
    const secretValue = "revalidate-secret-0123456789-abcdefghijkl";
    expect(
      loadConfig({
        ...valid,
        PUBLIC_APP_INTERNAL_URL: "http://frontend-public:3000",
        REVALIDATE_SECRET: secretValue,
      }).revalidation,
    ).toEqual({ url: "http://frontend-public:3000", secret: secretValue });
    expect(() =>
      loadConfig({ ...valid, PUBLIC_APP_INTERNAL_URL: "http://frontend-public:3000/app" }),
    ).toThrow(/PUBLIC_APP_INTERNAL_URL/);
    expect(() => loadConfig({ ...valid, REVALIDATE_SECRET: "short" })).toThrow(/REVALIDATE_SECRET/);
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

describe("HLS signing keys", () => {
  const keyOne = "dev-hls-key-one-0123456789abcdefgh";
  const keyTwo = "dev-hls-key-two-0123456789abcdefgh";

  test("are absent by default", () => {
    expect(loadConfig(valid).hls).toBeUndefined();
  });

  test("parse a list of id:secret pairs, active key defaults to the first", () => {
    const config = loadConfig({ ...valid, HLS_SIGNING_KEYS: `k1:${keyOne},k2:${keyTwo}` });
    expect(config.hls?.activeKeyId).toBe("k1");
    expect([...(config.hls?.keys ?? new Map())]).toEqual([
      ["k1", keyOne],
      ["k2", keyTwo],
    ]);
  });

  test("a chosen active key must be in the list", () => {
    const keys = `k1:${keyOne},k2:${keyTwo}`;
    expect(
      loadConfig({ ...valid, HLS_SIGNING_KEYS: keys, HLS_ACTIVE_KEY_ID: "k2" }).hls,
    ).toMatchObject({
      activeKeyId: "k2",
    });
    expect(() => loadConfig({ ...valid, HLS_SIGNING_KEYS: keys, HLS_ACTIVE_KEY_ID: "k3" })).toThrow(
      /HLS_ACTIVE_KEY_ID/,
    );
  });

  test.each([
    ["a short secret", "k1:short"],
    ["a missing secret", "k1:"],
    ["a missing id", `:${keyOne}`],
    ["an id with a dot", `k.1:${keyOne}`],
    ["a duplicate id", `k1:${keyOne},k1:${keyTwo}`],
    ["no separator", keyOne],
    ["an empty list", " , "],
  ])("refuses %s", (_name, keys) => {
    expect(() => loadConfig({ ...valid, HLS_SIGNING_KEYS: keys })).toThrow(/HLS_SIGNING_KEYS/);
  });

  test("the example environment declares valid keys", () => {
    const example = readFileSync(join(__dirname, "../../.env.example"), "utf8");
    const keys = example.match(/^HLS_SIGNING_KEYS=(.*)$/m)?.[1];
    expect(keys).toBeDefined();
    expect(loadConfig({ ...valid, HLS_SIGNING_KEYS: keys }).hls?.keys.size).toBe(2);
  });
});

describe("video uploads", () => {
  test("default to a local directory and a 24 hour expiry", () => {
    const { videoUploads } = loadConfig(valid);
    expect(videoUploads.expiryHours).toBe(24);
    expect(videoUploads.directory).toMatch(/\.data[\\/]uploads$/);
  });

  test("take the directory and expiry from the environment", () => {
    const { videoUploads } = loadConfig({
      ...valid,
      VIDEO_UPLOAD_DIR: "/srv/heat/uploads",
      VIDEO_UPLOAD_EXPIRY_HOURS: "6",
    });
    expect(videoUploads).toEqual({ directory: "/srv/heat/uploads", expiryHours: 6 });
  });

  test("require the directory in production", () => {
    const production = {
      ...valid,
      ...productionMail,
      NODE_ENV: "production",
      ADMIN_APP_URL: "https://admin.example.test",
      TRUSTED_ORIGINS: "https://admin.example.test",
    };
    expect(() => loadConfig(production)).toThrow("VIDEO_UPLOAD_DIR");
    expect(
      loadConfig({
        ...production,
        VIDEO_UPLOAD_DIR: "/srv/heat/uploads",
        MEDIA_STORAGE_DIR: "/srv/heat/media/files",
        HLS_MEDIA_DIR: "/srv/heat/media/hls",
      }).videoUploads.directory,
    ).toBe("/srv/heat/uploads");
  });

  test("refuses a zero expiry", () => {
    expect(() => loadConfig({ ...valid, VIDEO_UPLOAD_EXPIRY_HOURS: "0" })).toThrow(
      "VIDEO_UPLOAD_EXPIRY_HOURS",
    );
  });
});

describe("transcode config", () => {
  test("defaults to a local HLS directory and a timeout of eight times the source", () => {
    const { transcode } = loadConfig(valid);
    expect(transcode.hlsDirectory).toMatch(/\.data[\\/]hls$/);
    expect(transcode.timeout).toEqual({ factor: 8, minSeconds: 600, maxSeconds: 14400 });
  });

  test("takes the directory and timeout from the environment", () => {
    const { transcode } = loadConfig({
      ...valid,
      HLS_MEDIA_DIR: "/srv/heat/media/hls",
      TRANSCODE_TIMEOUT_FACTOR: "4",
      TRANSCODE_TIMEOUT_MIN_SECONDS: "60",
      TRANSCODE_TIMEOUT_MAX_SECONDS: "3600",
    });
    expect(transcode).toEqual({
      hlsDirectory: "/srv/heat/media/hls",
      timeout: { factor: 4, minSeconds: 60, maxSeconds: 3600 },
    });
  });

  test("requires the directory in production", () => {
    const production = {
      ...valid,
      ...productionMail,
      NODE_ENV: "production",
      ADMIN_APP_URL: "https://admin.example.test",
      TRUSTED_ORIGINS: "https://admin.example.test",
      VIDEO_UPLOAD_DIR: "/srv/heat/uploads",
      MEDIA_STORAGE_DIR: "/srv/heat/media/files",
    };
    expect(() => loadConfig(production)).toThrow("HLS_MEDIA_DIR");
    expect(
      loadConfig({ ...production, HLS_MEDIA_DIR: "/srv/heat/media/hls" }).transcode.hlsDirectory,
    ).toBe("/srv/heat/media/hls");
  });

  test("refuses a minimum above the maximum and a zero factor", () => {
    expect(() =>
      loadConfig({
        ...valid,
        TRANSCODE_TIMEOUT_MIN_SECONDS: "900",
        TRANSCODE_TIMEOUT_MAX_SECONDS: "600",
      }),
    ).toThrow("TRANSCODE_TIMEOUT_MIN_SECONDS");
    expect(() => loadConfig({ ...valid, TRANSCODE_TIMEOUT_FACTOR: "0" })).toThrow(
      "TRANSCODE_TIMEOUT_FACTOR",
    );
  });
});

describe("video upload rate limit profiles", () => {
  test("keep the start tight and give chunk traffic room for a long upload", () => {
    const { profiles } = loadConfig(valid).rateLimit;
    expect(profiles.videoUploadStart.limit).toBeLessThanOrEqual(60);
    expect(profiles.videoUploadChunk.limit).toBeGreaterThanOrEqual(3000);
    expect(profiles.videoUploadChunk.ipLimit).toBeGreaterThan(profiles.videoUploadChunk.limit);
  });

  test("can be tuned from the environment", () => {
    const { profiles } = loadConfig({
      ...valid,
      RATE_LIMIT_VIDEO_UPLOAD_CHUNK_LIMIT: "9000",
    }).rateLimit;
    expect(profiles.videoUploadChunk.limit).toBe(9000);
  });
});

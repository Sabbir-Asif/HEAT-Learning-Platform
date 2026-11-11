import { resolve } from "node:path";
import { z } from "zod";
import { loadMailConfig } from "../mail/mail-config";
import type { MailConfig } from "../mail/mail-config";
import { loadRateLimitConfig } from "./rate-limit-config";
import type { RateLimitConfig } from "./rate-limit-config";

const positiveInt = z.coerce.number().int().positive();

const minimumDistinctSecretCharacters = 10;

const secret = z
  .string()
  .min(32)
  .refine(
    (value) => new Set(value).size >= minimumDistinctSecretCharacters,
    "secret has too little entropy",
  );

const encryptionKey = z
  .string()
  .transform((value) => Buffer.from(value, "base64"))
  .refine((key) => key.length === 32, "AUTH_ENCRYPTION_KEY must be 32 bytes, base64 encoded");

const hlsKeyId = /^[A-Za-z0-9_-]{1,32}$/;

const hlsSigningKeys = z
  .string()
  .transform((value, context) => {
    const keys = new Map<string, string>();
    for (const entry of value.split(",")) {
      const text = entry.trim();
      if (text === "") continue;
      const separator = text.indexOf(":");
      const id = separator < 0 ? "" : text.slice(0, separator);
      const keySecret = separator < 0 ? "" : text.slice(separator + 1);
      if (!hlsKeyId.test(id) || keySecret.length < 32 || keys.has(id)) {
        context.addIssue({ code: "custom", message: "HLS_SIGNING_KEYS entry is invalid" });
        return z.NEVER;
      }
      keys.set(id, keySecret);
    }
    if (keys.size === 0) {
      context.addIssue({ code: "custom", message: "HLS_SIGNING_KEYS has no keys" });
      return z.NEVER;
    }
    return keys;
  })
  .optional();

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    AUTH_ACCESS_SECRET: secret,
    AUTH_ENCRYPTION_KEY: encryptionKey,
    ARGON2_MEMORY_COST: positiveInt.default(19456),
    ARGON2_TIME_COST: positiveInt.default(2),
    ARGON2_PARALLELISM: positiveInt.default(1),
    ACCESS_TOKEN_TTL_SECONDS: positiveInt.default(600),
    REFRESH_TOKEN_TTL_DAYS: positiveInt.default(30),
    ADMIN_IDLE_MINUTES: positiveInt.default(30),
    ADMIN_SESSION_ABSOLUTE_HOURS: positiveInt.default(12),
    STUDENT_SESSION_ABSOLUTE_DAYS: positiveInt.default(30),
    REFRESH_GRACE_SECONDS: positiveInt.default(20),
    CSRF_SECRET: secret,
    NODE_ENV: z.string().optional(),
    TRUSTED_ORIGINS: z
      .string()
      .optional()
      .transform((value) =>
        (value ?? "")
          .split(",")
          .map((origin) => origin.trim())
          .filter((origin) => origin !== ""),
      )
      .refine(
        (origins) =>
          origins.every((origin) => URL.canParse(origin) && new URL(origin).origin === origin),
        "TRUSTED_ORIGINS must be a comma separated list of origins without a path",
      ),
    ADMIN_INVITE_TTL_HOURS: positiveInt.default(72),
    VERIFICATION_TOKEN_TTL_HOURS: positiveInt.default(48),
    ADMIN_APP_URL: z
      .url()
      .optional()
      .refine(
        (value) => value === undefined || new URL(value).origin === value,
        "ADMIN_APP_URL must be an origin",
      ),
    AUDIT_TRANSACTION_MAX_WAIT_MS: positiveInt.default(5000),
    AUDIT_TRANSACTION_TIMEOUT_MS: positiveInt.default(15000),
    RESPONSE_FLOOR_MS: positiveInt.default(1000),
    VIDEO_UPLOAD_DIR: z.string().min(1).optional(),
    VIDEO_UPLOAD_EXPIRY_HOURS: positiveInt.default(24),
    HLS_SIGNING_KEYS: hlsSigningKeys,
    HLS_ACTIVE_KEY_ID: z.string().regex(hlsKeyId).optional(),
    BREACHED_PASSWORD_RANGE_URL: z.url().default("https://api.pwnedpasswords.com/range/"),
  })
  .superRefine((env, context) => {
    if (
      env.HLS_ACTIVE_KEY_ID !== undefined &&
      !(env.HLS_SIGNING_KEYS?.has(env.HLS_ACTIVE_KEY_ID) ?? false)
    ) {
      context.addIssue({
        code: "custom",
        path: ["HLS_ACTIVE_KEY_ID"],
        message: "HLS_ACTIVE_KEY_ID must be one of the HLS_SIGNING_KEYS ids",
      });
    }
    if (env.NODE_ENV === "production" && env.VIDEO_UPLOAD_DIR === undefined) {
      context.addIssue({
        code: "custom",
        path: ["VIDEO_UPLOAD_DIR"],
        message: "VIDEO_UPLOAD_DIR is required in production",
      });
    }
    if (env.NODE_ENV === "production" && env.ADMIN_APP_URL === undefined) {
      context.addIssue({
        code: "custom",
        path: ["ADMIN_APP_URL"],
        message: "ADMIN_APP_URL is required in production",
      });
    }
    if (env.NODE_ENV === "production" && env.TRUSTED_ORIGINS.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["TRUSTED_ORIGINS"],
        message: "TRUSTED_ORIGINS is required in production",
      });
    }
  });

const localVideoUploadDirectory = "../../.data/uploads";
const localAdminAppUrl = "http://localhost:3001";
const localTrustedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://learn.localhost",
  "http://admin.localhost",
];

export interface HlsConfig {
  keys: ReadonlyMap<string, string>;
  activeKeyId: string;
}

export interface VideoUploadConfig {
  directory: string;
  expiryHours: number;
}

export interface AppConfig {
  databaseUrl: string;
  redisUrl: string;
  auth: {
    accessSecret: string;
    encryptionKey: Buffer;
    accessTokenTtlSeconds: number;
    refreshTokenTtlDays: number;
    adminIdleMinutes: number;
    adminSessionAbsoluteHours: number;
    studentSessionAbsoluteDays: number;
    refreshGraceSeconds: number;
  };
  csrf: { secret: string; trustedOrigins: readonly string[] };
  argon2: { memoryCost: number; timeCost: number; parallelism: number };
  breachedPasswordRangeUrl: string;
  invitations: { ttlHours: number; adminAppUrl: string };
  verification: { tokenTtlHours: number };
  audit: { transactionMaxWaitMs: number; transactionTimeoutMs: number };
  accountProtection: { responseFloorMs: number };
  rateLimit: RateLimitConfig;
  hls: HlsConfig | undefined;
  videoUploads: VideoUploadConfig;
  mail: MailConfig;
}

const hlsOf = (
  keys: ReadonlyMap<string, string> | undefined,
  activeKeyId: string | undefined,
): HlsConfig | undefined => {
  if (keys === undefined) return undefined;
  const first = keys.keys().next().value;
  return { keys, activeKeyId: activeKeyId ?? String(first) };
};

export const APP_CONFIG = Symbol("APP_CONFIG");

export const loadConfig = (env: NodeJS.ProcessEnv): AppConfig => {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
    throw new Error(`Invalid environment configuration: ${names.join(", ")}`);
  }
  const rateLimit = loadRateLimitConfig(env);
  const values = parsed.data;
  return {
    databaseUrl: values.DATABASE_URL,
    redisUrl: values.REDIS_URL,
    auth: {
      accessSecret: values.AUTH_ACCESS_SECRET,
      encryptionKey: values.AUTH_ENCRYPTION_KEY,
      accessTokenTtlSeconds: values.ACCESS_TOKEN_TTL_SECONDS,
      refreshTokenTtlDays: values.REFRESH_TOKEN_TTL_DAYS,
      adminIdleMinutes: values.ADMIN_IDLE_MINUTES,
      adminSessionAbsoluteHours: values.ADMIN_SESSION_ABSOLUTE_HOURS,
      studentSessionAbsoluteDays: values.STUDENT_SESSION_ABSOLUTE_DAYS,
      refreshGraceSeconds: values.REFRESH_GRACE_SECONDS,
    },
    csrf: {
      secret: values.CSRF_SECRET,
      trustedOrigins:
        values.TRUSTED_ORIGINS.length > 0 ? values.TRUSTED_ORIGINS : localTrustedOrigins,
    },
    argon2: {
      memoryCost: values.ARGON2_MEMORY_COST,
      timeCost: values.ARGON2_TIME_COST,
      parallelism: values.ARGON2_PARALLELISM,
    },
    breachedPasswordRangeUrl: values.BREACHED_PASSWORD_RANGE_URL,
    invitations: {
      ttlHours: values.ADMIN_INVITE_TTL_HOURS,
      adminAppUrl: values.ADMIN_APP_URL ?? localAdminAppUrl,
    },
    verification: { tokenTtlHours: values.VERIFICATION_TOKEN_TTL_HOURS },
    audit: {
      transactionMaxWaitMs: values.AUDIT_TRANSACTION_MAX_WAIT_MS,
      transactionTimeoutMs: values.AUDIT_TRANSACTION_TIMEOUT_MS,
    },
    accountProtection: { responseFloorMs: values.RESPONSE_FLOOR_MS },
    rateLimit,
    hls: hlsOf(values.HLS_SIGNING_KEYS, values.HLS_ACTIVE_KEY_ID),
    videoUploads: {
      directory: values.VIDEO_UPLOAD_DIR ?? resolve(localVideoUploadDirectory),
      expiryHours: values.VIDEO_UPLOAD_EXPIRY_HOURS,
    },
    mail: loadMailConfig(env),
  };
};

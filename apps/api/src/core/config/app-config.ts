import { z } from "zod";
import { loadRateLimitConfig } from "./rate-limit-config";
import type { RateLimitConfig } from "./rate-limit-config";

const positiveInt = z.coerce.number().int().positive();

const encryptionKey = z
  .string()
  .transform((value) => Buffer.from(value, "base64"))
  .refine((key) => key.length === 32, "AUTH_ENCRYPTION_KEY must be 32 bytes, base64 encoded");

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    AUTH_ACCESS_SECRET: z.string().min(32),
    AUTH_ENCRYPTION_KEY: encryptionKey,
    ARGON2_MEMORY_COST: positiveInt.default(19456),
    ARGON2_TIME_COST: positiveInt.default(2),
    ARGON2_PARALLELISM: positiveInt.default(1),
    ACCESS_TOKEN_TTL_SECONDS: positiveInt.default(600),
    REFRESH_TOKEN_TTL_DAYS: positiveInt.default(30),
    ADMIN_IDLE_MINUTES: positiveInt.default(30),
    REFRESH_GRACE_SECONDS: positiveInt.default(20),
    CSRF_SECRET: z.string().min(32),
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
    ADMIN_APP_URL: z
      .url()
      .optional()
      .refine(
        (value) => value === undefined || new URL(value).origin === value,
        "ADMIN_APP_URL must be an origin",
      ),
    BREACHED_PASSWORD_RANGE_URL: z.url().default("https://api.pwnedpasswords.com/range/"),
  })
  .superRefine((env, context) => {
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

const localAdminAppUrl = "http://localhost:3001";
const localTrustedOrigins = ["http://localhost:3000", "http://localhost:3001"];

export interface AppConfig {
  databaseUrl: string;
  redisUrl: string;
  auth: {
    accessSecret: string;
    encryptionKey: Buffer;
    accessTokenTtlSeconds: number;
    refreshTokenTtlDays: number;
    adminIdleMinutes: number;
    refreshGraceSeconds: number;
  };
  csrf: { secret: string; trustedOrigins: readonly string[] };
  argon2: { memoryCost: number; timeCost: number; parallelism: number };
  breachedPasswordRangeUrl: string;
  invitations: { ttlHours: number; adminAppUrl: string };
  rateLimit: RateLimitConfig;
}

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
    rateLimit,
  };
};

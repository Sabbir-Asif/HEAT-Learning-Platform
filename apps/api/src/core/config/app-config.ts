import { z } from "zod";

const positiveInt = z.coerce.number().int().positive();

const encryptionKey = z
  .string()
  .transform((value) => Buffer.from(value, "base64"))
  .refine((key) => key.length === 32, "AUTH_ENCRYPTION_KEY must be 32 bytes, base64 encoded");

const envSchema = z.object({
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
  BREACHED_PASSWORD_RANGE_URL: z.url().default("https://api.pwnedpasswords.com/range/"),
});

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
  argon2: { memoryCost: number; timeCost: number; parallelism: number };
  breachedPasswordRangeUrl: string;
}

export const APP_CONFIG = Symbol("APP_CONFIG");

export const loadConfig = (env: NodeJS.ProcessEnv): AppConfig => {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
    throw new Error(`Invalid environment configuration: ${names.join(", ")}`);
  }
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
    argon2: {
      memoryCost: values.ARGON2_MEMORY_COST,
      timeCost: values.ARGON2_TIME_COST,
      parallelism: values.ARGON2_PARALLELISM,
    },
    breachedPasswordRangeUrl: values.BREACHED_PASSWORD_RANGE_URL,
  };
};

import { z } from "zod";

export const rateLimitProfileNames = [
  "signIn",
  "adminSignIn",
  "sessionRefresh",
  "passwordChange",
  "captcha",
  "enrollment",
  "reset",
  "verify",
  "resendVerification",
  "adminInvite",
  "playbackSession",
  "directoryLookup",
] as const;

export type RateLimitProfileName = (typeof rateLimitProfileNames)[number];

export interface RateLimitProfile {
  limit: number;
  windowSeconds: number;
  ipLimit: number;
}

export interface LockoutPolicy {
  threshold: number;
  baseSeconds: number;
  maxSeconds: number;
  memorySeconds: number;
  accountThreshold: number;
}

export interface RateLimitConfig {
  profiles: Record<RateLimitProfileName, RateLimitProfile>;
  lockout: LockoutPolicy;
  redisTimeoutMs: number;
}

export const ipWindowSeconds = 60;

const ipOnlyProfiles: readonly RateLimitProfileName[] = ["directoryLookup"];

const defaults: Record<RateLimitProfileName, RateLimitProfile> = {
  signIn: { limit: 10, windowSeconds: 900, ipLimit: 1000 },
  adminSignIn: { limit: 5, windowSeconds: 900, ipLimit: 120 },
  sessionRefresh: { limit: 60, windowSeconds: 60, ipLimit: 600 },
  passwordChange: { limit: 5, windowSeconds: 900, ipLimit: 120 },
  captcha: { limit: 60, windowSeconds: 60, ipLimit: 600 },
  enrollment: { limit: 5, windowSeconds: 3600, ipLimit: 300 },
  reset: { limit: 5, windowSeconds: 3600, ipLimit: 300 },
  verify: { limit: 10, windowSeconds: 900, ipLimit: 300 },
  resendVerification: { limit: 3, windowSeconds: 3600, ipLimit: 300 },
  adminInvite: { limit: 60, windowSeconds: 3600, ipLimit: 300 },
  playbackSession: { limit: 30, windowSeconds: 60, ipLimit: 3000 },
  directoryLookup: { limit: 600, windowSeconds: 60, ipLimit: 3000 },
};

const lockoutDefaults: LockoutPolicy = {
  threshold: 5,
  baseSeconds: 30,
  maxSeconds: 900,
  memorySeconds: 3600,
  accountThreshold: 50,
};

const redisTimeoutDefaultMs = 200;

const positiveInt = z.coerce.number().int().positive();

const screamingSnake = (name: string): string =>
  name.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();

export const rateLimitEnvName = (profile: RateLimitProfileName, field: string): string =>
  `RATE_LIMIT_${screamingSnake(profile)}_${field}`;

const readPositive = (
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  invalid: string[],
): number => {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = positiveInt.safeParse(raw);
  if (parsed.success) return parsed.data;
  invalid.push(name);
  return fallback;
};

export const loadRateLimitConfig = (env: NodeJS.ProcessEnv): RateLimitConfig => {
  const invalid: string[] = [];
  const profiles = Object.fromEntries(
    rateLimitProfileNames.map((name) => {
      const base = defaults[name];
      const ipOnly = ipOnlyProfiles.includes(name);
      return [
        name,
        {
          limit: ipOnly
            ? base.limit
            : readPositive(env, rateLimitEnvName(name, "LIMIT"), base.limit, invalid),
          windowSeconds: ipOnly
            ? base.windowSeconds
            : readPositive(
                env,
                rateLimitEnvName(name, "WINDOW_SECONDS"),
                base.windowSeconds,
                invalid,
              ),
          ipLimit: readPositive(env, rateLimitEnvName(name, "IP_LIMIT"), base.ipLimit, invalid),
        },
      ];
    }),
  ) as Record<RateLimitProfileName, RateLimitProfile>;
  const lockout: LockoutPolicy = {
    threshold: readPositive(env, "LOCKOUT_THRESHOLD", lockoutDefaults.threshold, invalid),
    baseSeconds: readPositive(env, "LOCKOUT_BASE_SECONDS", lockoutDefaults.baseSeconds, invalid),
    maxSeconds: readPositive(env, "LOCKOUT_MAX_SECONDS", lockoutDefaults.maxSeconds, invalid),
    memorySeconds: readPositive(
      env,
      "LOCKOUT_MEMORY_SECONDS",
      lockoutDefaults.memorySeconds,
      invalid,
    ),
    accountThreshold: readPositive(
      env,
      "LOCKOUT_ACCOUNT_THRESHOLD",
      lockoutDefaults.accountThreshold,
      invalid,
    ),
  };
  const redisTimeoutMs = readPositive(
    env,
    "RATE_LIMIT_REDIS_TIMEOUT_MS",
    redisTimeoutDefaultMs,
    invalid,
  );
  if (invalid.length > 0) {
    throw new Error(`Invalid environment configuration: ${invalid.join(", ")}`);
  }
  return { profiles, lockout, redisTimeoutMs };
};

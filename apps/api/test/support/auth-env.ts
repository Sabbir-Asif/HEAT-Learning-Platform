import { randomBytes } from "node:crypto";

export const authTestEnvironment = {
  AUTH_ACCESS_SECRET: "test-access-secret-0123456789-abcdefghijklmnop",
  AUTH_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  CSRF_SECRET: "test-csrf-secret-0123456789-abcdefghijklmnopqrs",
  ARGON2_MEMORY_COST: "8",
  ARGON2_TIME_COST: "1",
  ARGON2_PARALLELISM: "1",
} as const;

export const applyEnvironment = (values: Record<string, string>): (() => void) => {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
};

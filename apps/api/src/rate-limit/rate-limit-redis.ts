import { Redis } from "ioredis";

export const RATE_LIMIT_REDIS = Symbol("RATE_LIMIT_REDIS");

export const createRateLimitRedis = (url: string, commandTimeoutMs: number): Redis => {
  const client = new Redis(url, {
    lazyConnect: true,
    commandTimeout: commandTimeoutMs,
    maxRetriesPerRequest: 1,
  });
  client.on("error", () => undefined);
  return client;
};

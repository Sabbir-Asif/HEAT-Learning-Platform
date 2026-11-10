import { Redis } from "ioredis";

export const DIRECTORY_CACHE_REDIS = Symbol("DIRECTORY_CACHE_REDIS");

export const directoryCacheCommandTimeoutMs = 200;

export const createDirectoryCacheRedis = (url: string): Redis => {
  const client = new Redis(url, {
    lazyConnect: true,
    commandTimeout: directoryCacheCommandTimeoutMs,
    maxRetriesPerRequest: 1,
  });
  client.on("error", () => undefined);
  return client;
};

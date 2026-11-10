import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Redis } from "ioredis";
import { DIRECTORY_CACHE_REDIS } from "./directory-cache.redis";

export const directoryCacheTtlSeconds = 300;

export const directoryEmptyCacheTtlSeconds = 30;

const generationKey = "directory:lookup:generation";

const keyFor = (generation: string, name: string): string =>
  `directory:lookup:g${generation}:${name}`;

@Injectable()
export class DirectoryCache {
  private readonly logger = new Logger(DirectoryCache.name);

  constructor(@Inject(DIRECTORY_CACHE_REDIS) private readonly redis: Redis) {}

  async remember<T>(
    name: string,
    load: () => Promise<T>,
    ttlSecondsOf: (value: T) => number = () => directoryCacheTtlSeconds,
  ): Promise<T> {
    const key = await this.currentKey(name);
    if (key === undefined) return load();
    const hit = await this.read<T>(key);
    if (hit !== undefined) return hit;
    const value = await load();
    await this.write(key, value, ttlSecondsOf(value));
    return value;
  }

  async invalidate(): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await this.redis.set(generationKey, randomUUID());
        return;
      } catch {
        continue;
      }
    }
    this.logger.warn("Directory cache invalidation failed, entries expire on their own");
  }

  private async currentKey(name: string): Promise<string | undefined> {
    try {
      return keyFor(await this.generation(), name);
    } catch {
      this.logger.warn("Directory cache unavailable, reading from the database");
      return undefined;
    }
  }

  private async generation(): Promise<string> {
    const existing = await this.redis.get(generationKey);
    if (existing !== null) return existing;
    await this.redis.set(generationKey, randomUUID(), "NX");
    return (await this.redis.get(generationKey)) ?? randomUUID();
  }

  private async read<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await this.redis.get(key);
      return raw === null ? undefined : (JSON.parse(raw) as T);
    } catch {
      return undefined;
    }
  }

  private async write(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch {
      this.logger.warn("Directory cache write failed");
    }
  }
}

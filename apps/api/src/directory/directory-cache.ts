import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Redis } from "ioredis";
import { DIRECTORY_CACHE_REDIS } from "./directory-cache.redis";

export const directoryCacheTtlSeconds = 300;

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
    shouldStore: (value: T) => boolean = () => true,
  ): Promise<T> {
    const key = await this.currentKey(name);
    if (key === undefined) return load();
    const hit = await this.read<T>(key);
    if (hit !== undefined) return hit;
    const value = await load();
    if (shouldStore(value)) await this.write(key, value);
    return value;
  }

  async invalidate(): Promise<void> {
    try {
      await this.redis.incr(generationKey);
    } catch {
      this.logger.warn("Directory cache invalidation failed, entries expire on their own");
    }
  }

  private async currentKey(name: string): Promise<string | undefined> {
    try {
      const generation = await this.redis.get(generationKey);
      return keyFor(generation ?? "0", name);
    } catch {
      this.logger.warn("Directory cache unavailable, reading from the database");
      return undefined;
    }
  }

  private async read<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await this.redis.get(key);
      return raw === null ? undefined : (JSON.parse(raw) as T);
    } catch {
      return undefined;
    }
  }

  private async write(key: string, value: unknown): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), "EX", directoryCacheTtlSeconds);
    } catch {
      this.logger.warn("Directory cache write failed");
    }
  }
}

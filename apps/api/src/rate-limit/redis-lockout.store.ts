import { Inject, Injectable } from "@nestjs/common";
import type { Redis } from "ioredis";
import { REDIS } from "../core";
import { LockoutStore } from "./lockout.store";

const incrementScript = `
local failures = redis.call('HINCRBY', KEYS[1], 'failures', 1)
redis.call('EXPIRE', KEYS[1], ARGV[1])
return failures
`;

const lockScript = `
local current = tonumber(redis.call('HGET', KEYS[1], 'until') or '0')
if tonumber(ARGV[1]) > current then
  redis.call('HSET', KEYS[1], 'until', ARGV[1])
end
redis.call('EXPIRE', KEYS[1], ARGV[2])
return 1
`;

@Injectable()
export class RedisLockoutStore extends LockoutStore {
  constructor(@Inject(REDIS) private readonly redis: Redis) {
    super();
  }

  async increment(key: string, memorySeconds: number): Promise<number> {
    return Number(await this.redis.eval(incrementScript, 1, key, memorySeconds));
  }

  async lockUntil(key: string, untilMs: number, memorySeconds: number): Promise<void> {
    await this.redis.eval(lockScript, 1, key, untilMs, memorySeconds);
  }

  async lockedUntil(key: string): Promise<number> {
    return Number((await this.redis.hget(key, "until")) ?? 0);
  }

  async clear(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

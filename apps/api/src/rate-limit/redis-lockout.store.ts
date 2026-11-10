import { Inject, Injectable } from "@nestjs/common";
import type { Redis } from "ioredis";
import type { LockoutPolicy } from "../core";
import { LockoutStore } from "./lockout.store";
import { RATE_LIMIT_REDIS } from "./rate-limit-redis";

const reserveScript = `
local now = tonumber(ARGV[1])
local threshold = tonumber(ARGV[2])
local base = tonumber(ARGV[3])
local cap = tonumber(ARGV[4])
local windowMs = tonumber(ARGV[5]) * 1000
local accountThreshold = tonumber(ARGV[6])

local function lockedUntil(key)
  return tonumber(redis.call('HGET', key, 'until') or '0')
end

local locked = math.max(lockedUntil(KEYS[1]), lockedUntil(KEYS[2]))
if locked > now then
  return locked
end

local function touch(key)
  local start = tonumber(redis.call('HGET', key, 'start') or '0')
  if start == 0 or now >= start + windowMs then
    redis.call('DEL', key)
    start = now
    redis.call('HSET', key, 'start', start)
  end
  local failures = redis.call('HINCRBY', key, 'failures', 1)
  return failures, start
end

local function expire(key, start)
  local expiresAt = math.max(start + windowMs, lockedUntil(key))
  redis.call('PEXPIREAT', key, expiresAt)
end

local failures, start = touch(KEYS[1])
if failures >= threshold then
  local delay = math.min(base * 2 ^ math.min(failures - threshold, 30), cap)
  redis.call('HSET', KEYS[1], 'until', now + delay * 1000)
end
expire(KEYS[1], start)

local accountFailures, accountStart = touch(KEYS[2])
if accountFailures >= accountThreshold then
  redis.call('HSET', KEYS[2], 'until', now + cap * 1000)
end
expire(KEYS[2], accountStart)
return 0
`;

const releaseScript = `
redis.call('DEL', KEYS[1])
local failures = tonumber(redis.call('HGET', KEYS[2], 'failures') or '0')
if failures > 0 then
  redis.call('HINCRBY', KEYS[2], 'failures', -1)
end
return 1
`;

@Injectable()
export class RedisLockoutStore extends LockoutStore {
  constructor(@Inject(RATE_LIMIT_REDIS) private readonly redis: Redis) {
    super();
  }

  async reserve(
    attemptKey: string,
    accountKey: string,
    nowMs: number,
    policy: LockoutPolicy,
  ): Promise<number> {
    return Number(
      await this.redis.eval(
        reserveScript,
        2,
        attemptKey,
        accountKey,
        nowMs,
        policy.threshold,
        policy.baseSeconds,
        policy.maxSeconds,
        policy.memorySeconds,
        policy.accountThreshold,
      ),
    );
  }

  async release(attemptKey: string, accountKey: string): Promise<void> {
    await this.redis.eval(releaseScript, 2, attemptKey, accountKey);
  }

  async clearAccount(accountKey: string): Promise<void> {
    const keys = [accountKey];
    let cursor = "0";
    do {
      const [next, found] = await this.redis.scan(cursor, "MATCH", `${accountKey}:*`, "COUNT", 500);
      cursor = next;
      keys.push(...found);
    } while (cursor !== "0");
    await this.redis.del(...keys);
  }
}

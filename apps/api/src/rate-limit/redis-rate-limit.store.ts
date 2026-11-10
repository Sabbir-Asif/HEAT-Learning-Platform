import { Inject, Injectable } from "@nestjs/common";
import type { Redis } from "ioredis";
import { RATE_LIMIT_REDIS } from "./rate-limit-redis";
import { RateLimitStore } from "./rate-limit.store";
import type { RateLimitHit } from "./rate-limit.store";

const hitScript = `
local count = redis.call('INCR', KEYS[1])
local ttl = redis.call('TTL', KEYS[1])
if count == 1 or ttl < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {count, ttl}
`;

@Injectable()
export class RedisRateLimitStore extends RateLimitStore {
  constructor(@Inject(RATE_LIMIT_REDIS) private readonly redis: Redis) {
    super();
  }

  async hit(key: string, windowSeconds: number): Promise<RateLimitHit> {
    const result = (await this.redis.eval(hitScript, 1, key, windowSeconds)) as [number, number];
    return { count: Number(result[0]), ttlSeconds: Number(result[1]) };
  }
}

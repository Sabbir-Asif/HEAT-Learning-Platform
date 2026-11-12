import type { Redis } from "ioredis";
import type { ExpiryMetric } from "./expire-unverified";

export const EXPIRED_REGISTRATIONS_METRIC_KEY = "metrics:unverified_registrations_expired_total";

export class RedisExpiryMetric implements ExpiryMetric {
  constructor(private readonly redis: Redis) {}

  async add(count: number): Promise<void> {
    await this.redis.incrby(EXPIRED_REGISTRATIONS_METRIC_KEY, count);
  }
}

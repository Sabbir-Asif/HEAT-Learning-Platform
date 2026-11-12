import { Inject, Module } from "@nestjs/common";
import type { OnApplicationShutdown } from "@nestjs/common";
import type { Redis } from "ioredis";
import { APP_CONFIG, CoreModule } from "../core";
import type { AppConfig } from "../core";
import { AccountKeyHasher } from "./account-key.hasher";
import { LockoutStore } from "./lockout.store";
import { RATE_LIMIT_REDIS, createRateLimitRedis } from "./rate-limit-redis";
import { RateLimitStore } from "./rate-limit.store";
import { RateLimiter } from "./rate-limiter.service";
import { RedisLockoutStore } from "./redis-lockout.store";
import { RedisRateLimitStore } from "./redis-rate-limit.store";
import { SignInLockout } from "./sign-in-lockout.service";

@Module({
  imports: [CoreModule],
  providers: [
    AccountKeyHasher,
    RateLimiter,
    SignInLockout,
    {
      provide: RATE_LIMIT_REDIS,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        createRateLimitRedis(config.redisUrl, config.rateLimit.redisTimeoutMs),
    },
    { provide: RateLimitStore, useClass: RedisRateLimitStore },
    { provide: LockoutStore, useClass: RedisLockoutStore },
  ],
  exports: [AccountKeyHasher, RateLimiter, RateLimitStore, SignInLockout],
})
export class RateLimitModule implements OnApplicationShutdown {
  constructor(@Inject(RATE_LIMIT_REDIS) private readonly redis: Redis) {}

  onApplicationShutdown(): void {
    this.redis.disconnect();
  }
}

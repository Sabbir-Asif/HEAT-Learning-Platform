import { Module } from "@nestjs/common";
import { CoreModule } from "../core";
import { AccountKeyHasher } from "./account-key.hasher";
import { LockoutStore } from "./lockout.store";
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
    { provide: RateLimitStore, useClass: RedisRateLimitStore },
    { provide: LockoutStore, useClass: RedisLockoutStore },
  ],
  exports: [AccountKeyHasher, RateLimiter, SignInLockout],
})
export class RateLimitModule {}

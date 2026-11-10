import { Inject, Injectable, Logger } from "@nestjs/common";
import { APP_CONFIG, ipWindowSeconds } from "../core";
import type { AppConfig, RateLimitProfileName } from "../core";
import { ApiException } from "../http/api-exception";
import { RateLimitStore } from "./rate-limit.store";
import type { RateLimitHit } from "./rate-limit.store";

export interface RateLimitSubject {
  ip: string;
  accountKey?: string;
}

@Injectable()
export class RateLimiter {
  private readonly logger = new Logger(RateLimiter.name);

  constructor(
    private readonly store: RateLimitStore,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async consume(profileName: RateLimitProfileName, subject: RateLimitSubject): Promise<void> {
    const profile = this.config.rateLimit.profiles[profileName];
    try {
      const ip = await this.store.hit(`rl:${profileName}:ip:${subject.ip}`, ipWindowSeconds);
      if (ip.count > profile.ipLimit) throw this.exceeded(ip);
      if (subject.accountKey === undefined) return;
      const account = await this.store.hit(
        `rl:${profileName}:acct:${subject.accountKey}:${subject.ip}`,
        profile.windowSeconds,
      );
      if (account.count > profile.limit) throw this.exceeded(account);
    } catch (error) {
      if (error instanceof ApiException) throw error;
      this.logger.warn(`Rate limit store unavailable, allowing ${profileName} request`);
    }
  }

  private exceeded(hit: RateLimitHit): ApiException {
    return new ApiException(429, "RATE_LIMITED", Math.max(1, hit.ttlSeconds));
  }
}

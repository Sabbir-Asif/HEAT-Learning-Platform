import { Inject, Injectable, Logger } from "@nestjs/common";
import { APP_CONFIG, CLOCK } from "../core";
import type { AppConfig, Clock } from "../core";
import { ApiException } from "../http/api-exception";
import type { AuthRealm } from "../auth";
import { AccountKeyHasher } from "./account-key.hasher";
import { LockoutStore } from "./lockout.store";

@Injectable()
export class SignInLockout {
  private readonly logger = new Logger(SignInLockout.name);

  constructor(
    private readonly store: LockoutStore,
    private readonly hasher: AccountKeyHasher,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async assertOpen(realm: AuthRealm, email: string): Promise<void> {
    const now = this.clock.now().getTime();
    const until = await this.guarded(() => this.store.lockedUntil(this.keyFor(realm, email)), 0);
    if (until > now) throw new ApiException(429, "RATE_LIMITED", Math.ceil((until - now) / 1000));
  }

  async recordFailure(realm: AuthRealm, email: string): Promise<void> {
    const { threshold, baseSeconds, maxSeconds, memorySeconds } = this.config.rateLimit.lockout;
    const key = this.keyFor(realm, email);
    await this.guarded(async () => {
      const failures = await this.store.increment(key, memorySeconds);
      if (failures < threshold) return;
      const delaySeconds = Math.min(baseSeconds * 2 ** (failures - threshold), maxSeconds);
      const until = this.clock.now().getTime() + delaySeconds * 1000;
      await this.store.lockUntil(key, until, Math.max(memorySeconds, delaySeconds));
    }, undefined);
  }

  async recordSuccess(realm: AuthRealm, email: string): Promise<void> {
    await this.guarded(() => this.store.clear(this.keyFor(realm, email)), undefined);
  }

  private keyFor(realm: AuthRealm, email: string): string {
    return `lockout:${realm}:${this.hasher.forEmail(email)}`;
  }

  private async guarded<T>(action: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await action();
    } catch {
      this.logger.warn("Lockout store unavailable, sign-in lockout skipped");
      return fallback;
    }
  }
}

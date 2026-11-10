import { Inject, Injectable, Logger } from "@nestjs/common";
import { APP_CONFIG, CLOCK } from "../core";
import type { AppConfig, Clock } from "../core";
import { ApiException } from "../http/api-exception";
import type { AuthRealm } from "../auth";
import { AccountKeyHasher } from "./account-key.hasher";
import { ipBucket, unknownIpBucket } from "./ip-bucket";
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

  async reserve(realm: AuthRealm, email: string, ip: string | undefined): Promise<void> {
    const now = this.clock.now().getTime();
    const { attemptKey, accountKey } = this.keysFor(realm, email, ip);
    const until = await this.guarded(
      () => this.store.reserve(attemptKey, accountKey, now, this.config.rateLimit.lockout),
      0,
    );
    if (until > now) throw new ApiException(429, "RATE_LIMITED", Math.ceil((until - now) / 1000));
  }

  async recordSuccess(realm: AuthRealm, email: string, ip: string | undefined): Promise<void> {
    const { attemptKey, accountKey } = this.keysFor(realm, email, ip);
    await this.guarded(() => this.store.release(attemptKey, accountKey), undefined);
  }

  clearAccount(realm: AuthRealm, email: string): Promise<void> {
    return this.store.clearAccount(`lockout:${realm}:${this.hasher.forEmail(email)}`);
  }

  private keysFor(
    realm: AuthRealm,
    email: string,
    ip: string | undefined,
  ): { attemptKey: string; accountKey: string } {
    const account = this.hasher.forEmail(email);
    if (ip === undefined) this.logger.warn("Sign-in request has no client address");
    const bucket = ip === undefined ? unknownIpBucket : ipBucket(ip);
    return {
      attemptKey: `lockout:${realm}:${account}:${bucket}`,
      accountKey: `lockout:${realm}:${account}`,
    };
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

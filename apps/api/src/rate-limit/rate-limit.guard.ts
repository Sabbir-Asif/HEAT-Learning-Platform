import { Injectable, Logger } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { RateLimitProfileName } from "../core";
import type { AuthenticatedRequest } from "../auth";
import { AccountKeyHasher } from "./account-key.hasher";
import { ipBucket, unknownIpBucket } from "./ip-bucket";
import { RateLimiter } from "./rate-limiter.service";
import type { RateLimitSubject } from "./rate-limiter.service";

export const RATE_LIMIT_PROFILE_KEY = "rate-limit-profile";

interface RateLimitRequest extends AuthenticatedRequest {
  body?: unknown;
}

const emailFrom = (body: unknown): string | undefined => {
  if (typeof body !== "object" || body === null) return undefined;
  const email = (body as { email?: unknown }).email;
  return typeof email === "string" && email.trim() !== "" ? email : undefined;
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimiter,
    private readonly hasher: AccountKeyHasher,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const profile = this.reflector.getAllAndOverride<RateLimitProfileName | undefined>(
      RATE_LIMIT_PROFILE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (profile === undefined) return true;
    const request = context.switchToHttp().getRequest<RateLimitRequest>();
    await this.limiter.consume(profile, this.subjectOf(request));
    return true;
  }

  private subjectOf(request: RateLimitRequest): RateLimitSubject {
    if (request.ip === undefined) this.logger.warn("Request has no client address");
    const ip = request.ip === undefined ? unknownIpBucket : ipBucket(request.ip);
    if (request.authSession !== undefined) {
      return { ip, accountKey: this.hasher.forUser(request.authSession.userId) };
    }
    const email = emailFrom(request.body);
    return email === undefined ? { ip } : { ip, accountKey: this.hasher.forEmail(email) };
  }
}

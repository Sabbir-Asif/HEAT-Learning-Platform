import { SetMetadata, UseGuards, applyDecorators } from "@nestjs/common";
import type { RateLimitProfileName } from "../core";
import { RATE_LIMIT_PROFILE_KEY, RateLimitGuard } from "./rate-limit.guard";

export const RateLimit = (profile: RateLimitProfileName): MethodDecorator & ClassDecorator =>
  applyDecorators(SetMetadata(RATE_LIMIT_PROFILE_KEY, profile), UseGuards(RateLimitGuard));

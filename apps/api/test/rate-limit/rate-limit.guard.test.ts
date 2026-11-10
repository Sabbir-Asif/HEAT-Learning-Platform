import { Logger } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, test, vi } from "vitest";
import { loadConfig } from "../../src/core";
import { AccountKeyHasher } from "../../src/rate-limit/account-key.hasher";
import { RATE_LIMIT_PROFILE_KEY, RateLimitGuard } from "../../src/rate-limit/rate-limit.guard";
import type { RateLimiter, RateLimitSubject } from "../../src/rate-limit/rate-limiter.service";
import { authTestEnvironment } from "../support/auth-env";

const hasher = new AccountKeyHasher(
  loadConfig({ ...authTestEnvironment, DATABASE_URL: "postgresql://x", REDIS_URL: "redis://x" }),
);

const run = async (request: Record<string, unknown>): Promise<RateLimitSubject> => {
  const subjects: RateLimitSubject[] = [];
  const limiter = {
    consume: (_profile: string, subject: RateLimitSubject) => {
      subjects.push(subject);
      return Promise.resolve();
    },
  } as unknown as RateLimiter;
  const handler = () => undefined;
  Reflect.defineMetadata(RATE_LIMIT_PROFILE_KEY, "signIn", handler);
  const context = {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  await new RateLimitGuard(new Reflector(), limiter, hasher).canActivate(context);
  return subjects[0] as RateLimitSubject;
};

describe("RateLimitGuard subject", () => {
  test("buckets IPv6 clients by /64", async () => {
    const first = await run({ ip: "2001:db8:1:2::1", body: {} });
    const second = await run({ ip: "2001:db8:1:2:aaaa::7", body: {} });
    expect(first.ip).toBe(second.ip);
  });

  test("keeps IPv4 as is and keys the account from the email", async () => {
    const subject = await run({ ip: "203.0.113.4", body: { email: "A@b.test" } });
    expect(subject).toEqual({ ip: "203.0.113.4", accountKey: hasher.forEmail("a@b.test") });
  });

  test("warns without personal data when the address is missing", async () => {
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const subject = await run({ body: { email: "ada@example.test" } });
    expect(subject.ip).toBe("unknown");
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain("ada");
    warn.mockRestore();
  });
});

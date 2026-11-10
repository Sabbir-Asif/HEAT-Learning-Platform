import { describe, expect, test, vi } from "vitest";
import { Logger } from "@nestjs/common";
import { loadConfig } from "../../src/core";
import { RateLimiter } from "../../src/rate-limit/rate-limiter.service";
import { authTestEnvironment } from "../support/auth-env";
import { FakeClock, InMemoryRateLimitStore } from "../support/fakes";

const build = (extra: Record<string, string> = {}) => {
  const config = loadConfig({
    ...authTestEnvironment,
    DATABASE_URL: "postgresql://x",
    REDIS_URL: "redis://x",
    RATE_LIMIT_SIGN_IN_LIMIT: "3",
    RATE_LIMIT_SIGN_IN_WINDOW_SECONDS: "900",
    RATE_LIMIT_SIGN_IN_IP_LIMIT: "10",
    ...extra,
  });
  const clock = new FakeClock();
  const store = new InMemoryRateLimitStore(clock);
  return { clock, store, limiter: new RateLimiter(store, config) };
};

const outcome = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return "ok";
  } catch (error) {
    const { code, retryAfterSeconds } = error as { code?: string; retryAfterSeconds?: number };
    return `${code}:${retryAfterSeconds}`;
  }
};

describe("RateLimiter", () => {
  test("blocks the account and IP pair after its limit with the remaining window", async () => {
    const { limiter } = build();
    const results: string[] = [];
    for (let i = 0; i < 4; i++) {
      results.push(await outcome(limiter.consume("signIn", { ip: "1.1.1.1", accountKey: "a" })));
    }
    expect(results).toEqual(["ok", "ok", "ok", "RATE_LIMITED:900"]);
  });

  test("the same account from another IP has its own budget", async () => {
    const { limiter } = build();
    for (let i = 0; i < 4; i++) {
      await outcome(limiter.consume("signIn", { ip: "1.1.1.1", accountKey: "a" }));
    }
    expect(await outcome(limiter.consume("signIn", { ip: "2.2.2.2", accountKey: "a" }))).toBe("ok");
  });

  test("many different accounts from one IP are allowed up to the IP ceiling, then blocked", async () => {
    const { limiter } = build();
    const results: string[] = [];
    for (let i = 0; i < 11; i++) {
      results.push(
        await outcome(limiter.consume("signIn", { ip: "1.1.1.1", accountKey: `acct-${i}` })),
      );
    }
    expect(results.slice(0, 10).every((value) => value === "ok")).toBe(true);
    expect(results[10]).toBe("RATE_LIMITED:60");
  });

  test("requests without an account are held only by the IP ceiling", async () => {
    const { limiter } = build();
    for (let i = 0; i < 10; i++) {
      expect(await outcome(limiter.consume("signIn", { ip: "1.1.1.1" }))).toBe("ok");
    }
    expect(await outcome(limiter.consume("signIn", { ip: "1.1.1.1" }))).toBe("RATE_LIMITED:60");
  });

  test("the budget returns when the window ends", async () => {
    const { clock, limiter } = build();
    for (let i = 0; i < 4; i++) {
      await outcome(limiter.consume("signIn", { ip: "1.1.1.1", accountKey: "a" }));
    }
    clock.advanceSeconds(901);
    expect(await outcome(limiter.consume("signIn", { ip: "1.1.1.1", accountKey: "a" }))).toBe("ok");
  });

  test("profiles do not share counters", async () => {
    const { limiter } = build();
    for (let i = 0; i < 4; i++) {
      await outcome(limiter.consume("signIn", { ip: "1.1.1.1", accountKey: "a" }));
    }
    expect(await outcome(limiter.consume("adminSignIn", { ip: "1.1.1.1", accountKey: "a" }))).toBe(
      "ok",
    );
  });

  test("keys never contain a raw email", async () => {
    const { store, limiter } = build();
    await limiter.consume("signIn", { ip: "1.1.1.1", accountKey: "hashed" });
    expect([...store.keys.keys()]).toEqual([
      "rl:signIn:ip:1.1.1.1",
      "rl:signIn:acct:hashed:1.1.1.1",
    ]);
  });

  test("fails open with a warning when the store is down", async () => {
    const { store, limiter } = build();
    store.failing = true;
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    expect(await outcome(limiter.consume("signIn", { ip: "9.9.9.9", accountKey: "a" }))).toBe("ok");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("9.9.9.9");
    warn.mockRestore();
  });
});

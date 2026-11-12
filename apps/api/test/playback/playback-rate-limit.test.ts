import { describe, expect, test } from "vitest";
import { loadConfig } from "../../src/core";
import { RateLimiter } from "../../src/rate-limit/rate-limiter.service";
import { authTestEnvironment } from "../support/auth-env";
import { FakeClock, InMemoryRateLimitStore } from "../support/fakes";

const build = () => {
  const config = loadConfig({
    ...authTestEnvironment,
    DATABASE_URL: "postgresql://x",
    REDIS_URL: "redis://x",
  });
  return new RateLimiter(new InMemoryRateLimitStore(new FakeClock()), config);
};

const outcome = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return "ok";
  } catch (error) {
    return (error as { code?: string }).code ?? "error";
  }
};

describe("playbackSession rate limit", () => {
  test("the default profile is generous per IP and strict per account", () => {
    const { profiles } = loadConfig({
      ...authTestEnvironment,
      DATABASE_URL: "postgresql://x",
      REDIS_URL: "redis://x",
    }).rateLimit;
    expect(profiles.playbackSession.limit).toBe(30);
    expect(profiles.playbackSession.ipLimit).toBeGreaterThanOrEqual(1000);
  });

  test("an abusive account is refused with 429 while others behind the same IP continue", async () => {
    const limiter = build();
    const ip = "10.0.0.1";
    const results: string[] = [];
    for (let i = 0; i < 31; i++) {
      results.push(await outcome(limiter.consume("playbackSession", { ip, accountKey: "abuser" })));
    }
    expect(results.slice(0, 30).every((result) => result === "ok")).toBe(true);
    expect(results[30]).toBe("RATE_LIMITED");
    expect(await outcome(limiter.consume("playbackSession", { ip, accountKey: "other" }))).toBe(
      "ok",
    );
  });
});

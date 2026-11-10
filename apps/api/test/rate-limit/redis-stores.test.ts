import { describe, expect, test, vi } from "vitest";
import { RedisLockoutStore } from "../../src/rate-limit/redis-lockout.store";
import { RedisRateLimitStore } from "../../src/rate-limit/redis-rate-limit.store";

const policy = {
  threshold: 5,
  baseSeconds: 30,
  maxSeconds: 900,
  memorySeconds: 3600,
  accountThreshold: 20,
};

describe("RedisRateLimitStore", () => {
  test("hits the counter with the window and returns count and ttl", async () => {
    const eval_ = vi.fn().mockResolvedValue(["3", "42"]);

    const hit = await new RedisRateLimitStore({ eval: eval_ } as never).hit("key", 60);

    expect(hit).toEqual({ count: 3, ttlSeconds: 42 });
    expect(eval_).toHaveBeenCalledWith(expect.stringContaining("INCR"), 1, "key", 60);
  });
});

describe("RedisLockoutStore", () => {
  test("reserve passes both keys and the whole policy and returns the lock time", async () => {
    const eval_ = vi.fn().mockResolvedValue("1700000000000");

    const lockedUntil = await new RedisLockoutStore({ eval: eval_ } as never).reserve(
      "attempt",
      "account",
      1_699_999_000_000,
      policy,
    );

    expect(lockedUntil).toBe(1_700_000_000_000);
    expect(eval_).toHaveBeenCalledWith(
      expect.any(String),
      2,
      "attempt",
      "account",
      1_699_999_000_000,
      5,
      30,
      900,
      3600,
      20,
    );
  });

  test("release runs the script against both keys", async () => {
    const eval_ = vi.fn().mockResolvedValue(1);

    await new RedisLockoutStore({ eval: eval_ } as never).release("attempt", "account");

    expect(eval_).toHaveBeenCalledWith(expect.any(String), 2, "attempt", "account");
  });

  test("clearAccount scans every page and deletes the account and its per-address keys", async () => {
    const scan = vi
      .fn()
      .mockResolvedValueOnce(["7", ["account:a", "account:b"]])
      .mockResolvedValueOnce(["0", ["account:c"]]);
    const del = vi.fn().mockResolvedValue(4);

    await new RedisLockoutStore({ scan, del } as never).clearAccount("account");

    expect(scan).toHaveBeenNthCalledWith(1, "0", "MATCH", "account:*", "COUNT", 500);
    expect(scan).toHaveBeenNthCalledWith(2, "7", "MATCH", "account:*", "COUNT", 500);
    expect(del).toHaveBeenCalledWith("account", "account:a", "account:b", "account:c");
  });
});

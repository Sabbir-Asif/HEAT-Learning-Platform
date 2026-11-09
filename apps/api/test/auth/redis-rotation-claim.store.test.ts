import type { Redis } from "ioredis";
import { describe, expect, test, vi } from "vitest";
import { RedisRotationClaimStore } from "../../src/auth/redis-rotation-claim.store";

const build = (setResult: "OK" | null) => {
  const redis = {
    set: vi.fn().mockResolvedValue(setResult),
    get: vi.fn().mockResolvedValue("sealed"),
  };
  return { redis, store: new RedisRotationClaimStore(redis as unknown as Redis) };
};

describe("RedisRotationClaimStore", () => {
  test("claims with SET EX NX and reports whether it won", async () => {
    const won = build("OK");
    const lost = build(null);

    await expect(won.store.claim("k", "v", 20)).resolves.toBe(true);
    await expect(lost.store.claim("k", "v", 20)).resolves.toBe(false);
    expect(won.redis.set).toHaveBeenCalledWith("k", "v", "EX", 20, "NX");
  });

  test("reads a claim", async () => {
    const { store } = build("OK");

    await expect(store.read("k")).resolves.toBe("sealed");
  });
});

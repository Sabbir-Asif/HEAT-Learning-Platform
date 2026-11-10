import { describe, expect, test, vi } from "vitest";
import { DirectoryCache, directoryCacheTtlSeconds } from "../../src/directory/directory-cache";

const fakeRedis = (overrides: Record<string, unknown> = {}) => {
  const entries = new Map<string, string>();
  return {
    entries,
    get: vi.fn(async (key: string) => entries.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, ...flags: unknown[]) => {
      if (flags.includes("NX") && entries.has(key)) return null;
      entries.set(key, value);
      return "OK";
    }),
    ...overrides,
  };
};

const build = (overrides: Record<string, unknown> = {}) => {
  const redis = fakeRedis(overrides);
  return { redis, cache: new DirectoryCache(redis as never) };
};

describe("DirectoryCache.remember", () => {
  test("loads on a miss, stores with a ttl under the current generation, and serves the next call from the cache", async () => {
    const { cache, redis } = build();
    const load = vi.fn().mockResolvedValue({ items: [{ id: "a" }] });

    const first = await cache.remember("universities", load);
    const second = await cache.remember("universities", load);

    expect(first).toEqual({ items: [{ id: "a" }] });
    expect(second).toEqual(first);
    expect(load).toHaveBeenCalledOnce();
    expect(redis.set).toHaveBeenCalledWith(
      `directory:lookup:g${redis.entries.get("directory:lookup:generation")}:universities`,
      JSON.stringify(first),
      "EX",
      directoryCacheTtlSeconds,
    );
  });

  test("a new generation after invalidate misses the old entry", async () => {
    const { cache } = build();
    const load = vi.fn().mockResolvedValueOnce("old").mockResolvedValueOnce("new");

    await cache.remember("universities", load);
    await cache.invalidate();
    const after = await cache.remember("universities", load);

    expect(after).toBe("new");
    expect(load).toHaveBeenCalledTimes(2);
  });

  test("does not store a value the caller declines", async () => {
    const { cache, redis } = build();

    await cache.remember(
      "universities",
      async () => [],
      (value) => value.length > 0,
    );

    expect(redis.set).not.toHaveBeenCalledWith(
      expect.stringContaining(":universities"),
      expect.anything(),
      "EX",
      expect.anything(),
    );
  });

  test("reads from the loader when the cache is unreachable", async () => {
    const down = vi.fn().mockRejectedValue(new Error("connection refused"));
    const { cache } = build({ get: down, set: down });

    await expect(cache.remember("universities", async () => "fresh")).resolves.toBe("fresh");
  });

  test("a failing entry read or write still returns the loaded value", async () => {
    const generationThenFail = vi
      .fn()
      .mockResolvedValueOnce("3")
      .mockRejectedValueOnce(new Error("timeout"));
    const { cache } = build({
      get: generationThenFail,
      set: vi.fn().mockRejectedValue(new Error("timeout")),
    });

    await expect(cache.remember("universities", async () => "fresh")).resolves.toBe("fresh");
  });

  test("a corrupt entry is treated as a miss", async () => {
    const { cache, redis } = build();
    await cache.remember("universities", async () => "seed");
    const key = [...redis.entries.keys()].find((name) => name.endsWith(":universities")) ?? "";
    redis.entries.set(key, "{not json");

    await expect(cache.remember("universities", async () => "fresh")).resolves.toBe("fresh");
  });
});

describe("DirectoryCache generation", () => {
  test("a missing generation gets a fresh unique epoch, never a fixed starting value", async () => {
    const first = build();
    const second = build();

    await first.cache.remember("universities", async () => "a");
    await second.cache.remember("universities", async () => "b");

    const epoch = (redis: ReturnType<typeof fakeRedis>) =>
      redis.entries.get("directory:lookup:generation");
    expect(epoch(first.redis)).toBeTruthy();
    expect(epoch(first.redis)).not.toBe("0");
    expect(epoch(first.redis)).not.toBe(epoch(second.redis));
  });

  test("a flushed Redis does not bring back entries written under an earlier generation", async () => {
    const { cache, redis } = build();
    await cache.remember("universities", async () => "old");
    redis.entries.delete("directory:lookup:generation");

    const after = await cache.remember("universities", async () => "new");

    expect(after).toBe("new");
  });

  test("an existing generation is reused and not overwritten", async () => {
    const { cache, redis } = build();
    redis.entries.set("directory:lookup:generation", "epoch-1");

    await cache.remember("universities", async () => "x");

    expect(redis.entries.get("directory:lookup:generation")).toBe("epoch-1");
    expect(redis.entries.has("directory:lookup:gepoch-1:universities")).toBe(true);
  });
});

describe("DirectoryCache.invalidate", () => {
  test("replaces the generation with a new epoch", async () => {
    const { cache, redis } = build();
    redis.entries.set("directory:lookup:generation", "epoch-1");

    await cache.invalidate();

    expect(redis.entries.get("directory:lookup:generation")).not.toBe("epoch-1");
  });

  test("retries once when the first attempt fails", async () => {
    const set = vi.fn().mockRejectedValueOnce(new Error("blip")).mockResolvedValueOnce("OK");
    const { cache } = build({ set });

    await cache.invalidate();

    expect(set).toHaveBeenCalledTimes(2);
  });

  test("gives up after the retry and never throws", async () => {
    const set = vi.fn().mockRejectedValue(new Error("down"));
    const { cache } = build({ set });

    await expect(cache.invalidate()).resolves.toBeUndefined();
    expect(set).toHaveBeenCalledTimes(2);
  });
});

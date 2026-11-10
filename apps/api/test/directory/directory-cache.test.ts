import { describe, expect, test, vi } from "vitest";
import { DirectoryCache, directoryCacheTtlSeconds } from "../../src/directory/directory-cache";

const fakeRedis = (overrides: Record<string, unknown> = {}) => {
  const entries = new Map<string, string>();
  return {
    entries,
    get: vi.fn(async (key: string) => entries.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      entries.set(key, value);
      return "OK";
    }),
    incr: vi.fn(async (key: string) => {
      const next = Number(entries.get(key) ?? "0") + 1;
      entries.set(key, String(next));
      return next;
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
      "directory:lookup:g0:universities",
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

    expect(redis.set).not.toHaveBeenCalled();
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
    redis.entries.set("directory:lookup:g0:universities", "{not json");

    await expect(cache.remember("universities", async () => "fresh")).resolves.toBe("fresh");
  });
});

describe("DirectoryCache.invalidate", () => {
  test("bumps the generation once", async () => {
    const { cache, redis } = build();

    await cache.invalidate();

    expect(redis.incr).toHaveBeenCalledWith("directory:lookup:generation");
  });

  test("never throws when the cache is unreachable", async () => {
    const { cache } = build({ incr: vi.fn().mockRejectedValue(new Error("down")) });

    await expect(cache.invalidate()).resolves.toBeUndefined();
  });
});

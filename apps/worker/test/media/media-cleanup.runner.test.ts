import { afterEach, describe, expect, test, vi } from "vitest";
import type { Clock, MediaStorage } from "api/core";
import type { HeatClient } from "@heat/db";
import { MediaCleanupRunner } from "../../src/media/media-cleanup.runner";

const checkIntervalMs = 10 * 60 * 1000;

const build = (findMany: () => Promise<unknown[]>, clock: Clock) => {
  const database = { mediaAsset: { findMany, delete: vi.fn() } } as unknown as HeatClient;
  const storage = { removeAsset: vi.fn() } as unknown as MediaStorage;
  return new MediaCleanupRunner(database, storage, clock);
};

describe("MediaCleanupRunner", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("runs once per Dhaka day after the run hour", async () => {
    vi.useFakeTimers();
    const findMany = vi.fn().mockResolvedValue([]);
    const runner = build(findMany, { now: () => new Date("2026-11-17T00:00:00.000Z") });
    runner.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(checkIntervalMs * 6);
    expect(findMany).toHaveBeenCalledTimes(1);
    runner.onApplicationShutdown();
  });

  test("does not run before the run hour", async () => {
    vi.useFakeTimers();
    const findMany = vi.fn().mockResolvedValue([]);
    const runner = build(findMany, { now: () => new Date("2026-11-16T20:00:00.000Z") });
    runner.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(checkIntervalMs * 3);
    expect(findMany).not.toHaveBeenCalled();
    runner.onApplicationShutdown();
  });

  test("retries on the next check after a failed run", async () => {
    vi.useFakeTimers();
    const findMany = vi
      .fn()
      .mockRejectedValueOnce(new Error("database down"))
      .mockResolvedValue([]);
    const runner = build(findMany, { now: () => new Date("2026-11-17T00:00:00.000Z") });
    runner.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(checkIntervalMs * 3);
    expect(findMany).toHaveBeenCalledTimes(2);
    runner.onApplicationShutdown();
  });

  test("stops checking after shutdown", async () => {
    vi.useFakeTimers();
    const findMany = vi.fn().mockResolvedValue([]);
    const runner = build(findMany, { now: () => new Date("2026-11-17T00:00:00.000Z") });
    runner.onApplicationBootstrap();
    runner.onApplicationShutdown();
    await vi.advanceTimersByTimeAsync(checkIntervalMs * 3);
    expect(findMany).not.toHaveBeenCalled();
  });
});

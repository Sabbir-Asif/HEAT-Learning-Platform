import { afterEach, describe, expect, test, vi } from "vitest";
import type { Redis } from "ioredis";
import type { HeatClient } from "@heat/db";
import { ExpiryRunner } from "../../src/cleanup/expiry-runner";

const hourMs = 3_600_000;

const build = (findMany: () => Promise<unknown[]>, now: Date) =>
  new ExpiryRunner(
    { user: { findMany } } as unknown as HeatClient,
    { incrby: vi.fn() } as unknown as Redis,
    { now: () => now },
  );

describe("ExpiryRunner", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("waits for 02:00 Dhaka, runs, then schedules the next day", async () => {
    vi.useFakeTimers();
    const findMany = vi.fn().mockResolvedValue([]);
    const runner = build(findMany, new Date("2026-11-17T00:00:00.000Z"));
    runner.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(19 * hourMs);
    expect(findMany).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2 * hourMs);
    expect(findMany).toHaveBeenCalledTimes(1);
    runner.onApplicationShutdown();
  });

  test("keeps scheduling after a failed run", async () => {
    vi.useFakeTimers();
    const findMany = vi.fn().mockRejectedValue(new Error("database down"));
    const runner = build(findMany, new Date("2026-11-17T00:00:00.000Z"));
    runner.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(21 * hourMs);
    expect(findMany).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(24 * hourMs);
    expect(findMany).toHaveBeenCalledTimes(2);
    runner.onApplicationShutdown();
  });

  test("does not run after shutdown", async () => {
    vi.useFakeTimers();
    const findMany = vi.fn().mockResolvedValue([]);
    const runner = build(findMany, new Date("2026-11-17T00:00:00.000Z"));
    runner.onApplicationBootstrap();
    runner.onApplicationShutdown();
    await vi.advanceTimersByTimeAsync(48 * hourMs);
    expect(findMany).not.toHaveBeenCalled();
  });
});

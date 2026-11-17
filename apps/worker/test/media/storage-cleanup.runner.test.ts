import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { AppConfig, Clock } from "api/core";
import type { HeatClient } from "@heat/db";
import { StorageCleanupRunner } from "../../src/media/storage-cleanup.runner";

const checkIntervalMs = 10 * 60 * 1000;

describe("StorageCleanupRunner", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "storage-runner-"));
  });

  afterEach(async () => {
    vi.useRealTimers();
    await rm(directory, { recursive: true, force: true });
  });

  const build = (findMany: () => Promise<unknown[]>, clock: Clock) => {
    const database = { videoAsset: { findMany } } as unknown as HeatClient;
    const config = {
      videoUploads: { directory, expiryHours: 24 },
      transcode: { hlsDirectory: directory },
    } as unknown as AppConfig;
    return new StorageCleanupRunner(database, config, clock);
  };

  test("runs once per Dhaka day after 04:00", async () => {
    vi.useFakeTimers();
    const findMany = vi.fn().mockResolvedValue([]);
    const runner = build(findMany, { now: () => new Date("2026-11-17T00:00:00.000Z") });
    runner.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(checkIntervalMs);
    await vi.waitFor(() => expect(findMany.mock.calls.length).toBeGreaterThan(0));
    await vi.advanceTimersByTimeAsync(checkIntervalMs);
    const callsAfterFirstDay = findMany.mock.calls.length;
    await vi.advanceTimersByTimeAsync(checkIntervalMs * 6);
    expect(findMany.mock.calls.length).toBe(callsAfterFirstDay);
    runner.onApplicationShutdown();
  });

  test("does not run before 04:00 Dhaka", async () => {
    vi.useFakeTimers();
    const findMany = vi.fn().mockResolvedValue([]);
    const runner = build(findMany, { now: () => new Date("2026-11-16T21:00:00.000Z") });
    runner.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(checkIntervalMs * 3);
    expect(findMany).not.toHaveBeenCalled();
    runner.onApplicationShutdown();
  });
});

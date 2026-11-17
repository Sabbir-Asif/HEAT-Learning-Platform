import { afterEach, describe, expect, test, vi } from "vitest";
import type { Clock } from "api/core";
import type { HeatClient } from "@heat/db";
import { NewsPublicationRunner } from "../../src/news/news-publication.runner";

const pollIntervalMs = 60 * 1000;
const clock: Clock = { now: () => new Date("2026-11-17T00:00:00.000Z") };

const build = (findMany: () => Promise<unknown[]>) =>
  new NewsPublicationRunner({ newsPost: { findMany } } as unknown as HeatClient, clock);

describe("NewsPublicationRunner", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("looks for due posts on every poll and stops on shutdown", async () => {
    vi.useFakeTimers();
    const findMany = vi.fn().mockResolvedValue([]);
    const runner = build(findMany);
    runner.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(pollIntervalMs * 2);
    expect(findMany).toHaveBeenCalledTimes(2);
    runner.onApplicationShutdown();
    await vi.advanceTimersByTimeAsync(pollIntervalMs * 2);
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  test("skips a poll while the previous one is still running", async () => {
    vi.useFakeTimers();
    let release: () => void = () => undefined;
    const findMany = vi.fn().mockImplementation(
      () =>
        new Promise<unknown[]>((resolve) => {
          release = () => resolve([]);
        }),
    );
    const runner = build(findMany);
    runner.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(pollIntervalMs * 3);
    expect(findMany).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(pollIntervalMs);
    expect(findMany).toHaveBeenCalledTimes(2);
    runner.onApplicationShutdown();
  });

  test("a failing poll does not stop the schedule", async () => {
    vi.useFakeTimers();
    const findMany = vi.fn().mockRejectedValue(new Error("database down"));
    const runner = build(findMany);
    runner.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(pollIntervalMs * 2);
    expect(findMany).toHaveBeenCalledTimes(2);
    runner.onApplicationShutdown();
  });
});

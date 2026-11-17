import { afterEach, describe, expect, test, vi } from "vitest";
import {
  InsightsRollupRunner,
  insightsPollIntervalMs,
} from "../../src/insights/insights-rollup.runner";
import type { InsightsRollupService } from "api/core";

const serviceWith = (tick: () => Promise<null>): InsightsRollupService =>
  ({ tick }) as unknown as InsightsRollupService;

describe("InsightsRollupRunner", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("ticks on the poll interval and stops on shutdown", async () => {
    vi.useFakeTimers();
    const tick = vi.fn().mockResolvedValue(null);
    const runner = new InsightsRollupRunner(serviceWith(tick));
    runner.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(insightsPollIntervalMs * 2);
    expect(tick).toHaveBeenCalledTimes(2);
    runner.onApplicationShutdown();
    await vi.advanceTimersByTimeAsync(insightsPollIntervalMs * 2);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  test("does not start a tick while the previous one is still running", async () => {
    vi.useFakeTimers();
    let release: () => void = () => undefined;
    const tick = vi.fn().mockImplementation(
      () =>
        new Promise<null>((resolve) => {
          release = () => resolve(null);
        }),
    );
    const runner = new InsightsRollupRunner(serviceWith(tick));
    runner.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(insightsPollIntervalMs * 3);
    expect(tick).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(insightsPollIntervalMs);
    expect(tick).toHaveBeenCalledTimes(2);
    runner.onApplicationShutdown();
  });

  test("a failing tick does not stop the schedule", async () => {
    vi.useFakeTimers();
    const tick = vi.fn().mockRejectedValue(new Error("database down"));
    const runner = new InsightsRollupRunner(serviceWith(tick));
    runner.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(insightsPollIntervalMs * 2);
    expect(tick).toHaveBeenCalledTimes(2);
    runner.onApplicationShutdown();
  });
});

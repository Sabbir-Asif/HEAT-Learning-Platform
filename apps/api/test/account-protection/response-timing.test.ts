import { describe, expect, test } from "vitest";
import { ResponseTiming } from "../../src/account-protection";
import type { AppConfig } from "../../src/core";

const config = { accountProtection: { responseFloorMs: 100 } } as AppConfig;

const harness = () => {
  let time = 0;
  const slept: number[] = [];
  return {
    slept,
    advance: (milliseconds: number) => {
      time += milliseconds;
    },
    options: {
      now: () => time,
      sleep: async (milliseconds: number) => {
        slept.push(milliseconds);
        time += milliseconds;
      },
    },
  };
};

describe("response timing", () => {
  test("uses the configured floor by default and lets a call override it", async () => {
    const timing = harness();
    await new ResponseTiming(config).equalise(async () => {}, timing.options);
    await new ResponseTiming(config).equalise(async () => {}, { ...timing.options, floorMs: 40 });
    expect(timing.slept).toEqual([100, 40]);
  });

  test("pads fast work up to the floor", async () => {
    const timing = harness();
    const result = await new ResponseTiming(config).equalise(async () => {
      timing.advance(30);
      return "done";
    }, timing.options);
    expect(result).toBe("done");
    expect(timing.slept).toEqual([70]);
  });

  test("does not pad work that already exceeds the floor", async () => {
    const timing = harness();
    await new ResponseTiming(config).equalise(async () => {
      timing.advance(150);
    }, timing.options);
    expect(timing.slept).toEqual([]);
  });

  test("pads when the work throws and rethrows", async () => {
    const timing = harness();
    await expect(
      new ResponseTiming(config).equalise(async () => {
        timing.advance(10);
        throw new Error("failed");
      }, timing.options),
    ).rejects.toThrow("failed");
    expect(timing.slept).toEqual([90]);
  });
});

describe("response timing defaults", () => {
  test("measures with the real clock and sleeps for real when no hooks are given", async () => {
    const started = performance.now();
    const result = await new ResponseTiming(config).equalise(async () => "ok", { floorMs: 20 });
    expect(result).toBe("ok");
    expect(performance.now() - started).toBeGreaterThanOrEqual(15);
  });
});

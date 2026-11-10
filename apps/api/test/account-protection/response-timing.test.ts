import { describe, expect, test } from "vitest";
import { ResponseTiming } from "../../src/account-protection";

const harness = () => {
  let time = 0;
  const slept: number[] = [];
  return {
    slept,
    advance: (milliseconds: number) => {
      time += milliseconds;
    },
    options: {
      floorMs: 100,
      now: () => time,
      sleep: async (milliseconds: number) => {
        slept.push(milliseconds);
        time += milliseconds;
      },
    },
  };
};

describe("response timing", () => {
  test("pads fast work up to the floor", async () => {
    const timing = harness();
    const result = await new ResponseTiming().equalise(async () => {
      timing.advance(30);
      return "done";
    }, timing.options);
    expect(result).toBe("done");
    expect(timing.slept).toEqual([70]);
  });

  test("does not pad work that already exceeds the floor", async () => {
    const timing = harness();
    await new ResponseTiming().equalise(async () => {
      timing.advance(150);
    }, timing.options);
    expect(timing.slept).toEqual([]);
  });

  test("pads when the work throws and rethrows", async () => {
    const timing = harness();
    await expect(
      new ResponseTiming().equalise(async () => {
        timing.advance(10);
        throw new Error("failed");
      }, timing.options),
    ).rejects.toThrow("failed");
    expect(timing.slept).toEqual([90]);
  });
});

import { describe, expect, test } from "vitest";
import { createWatchTracker } from "../../src/player/watch-tracker";

const play = (tracker: ReturnType<typeof createWatchTracker>, from: number, to: number) => {
  let wall = 0;
  for (let time = from; time <= to; time += 0.25) {
    tracker.tick(time, wall);
    wall += 250;
  }
};

describe("createWatchTracker", () => {
  test("records one range for continuous playback", () => {
    const tracker = createWatchTracker({ maxRate: 1.5 });
    play(tracker, 0, 10);
    expect(tracker.take()).toEqual([{ start: 0, end: 10 }]);
  });

  test("a seek ends the range and the next one starts at the new position", () => {
    const tracker = createWatchTracker({ maxRate: 1.5 });
    play(tracker, 0, 5);
    tracker.breakAt(5);
    tracker.tick(100, 10_000);
    tracker.tick(100.25, 10_250);
    tracker.tick(105, 15_000);
    expect(tracker.take()).toEqual([
      { start: 0, end: 5 },
      { start: 100, end: 105 },
    ]);
  });

  test("a jump larger than the top speed allows is treated as a skip", () => {
    const tracker = createWatchTracker({ maxRate: 1.5 });
    tracker.tick(0, 0);
    tracker.tick(1, 1000);
    tracker.tick(120, 2000);
    tracker.tick(121, 3000);
    expect(tracker.take()).toEqual([
      { start: 0, end: 1 },
      { start: 120, end: 121 },
    ]);
  });

  test("playing at the top speed is not mistaken for a skip", () => {
    const tracker = createWatchTracker({ maxRate: 1.5 });
    tracker.tick(0, 0);
    tracker.tick(1.5, 1000);
    tracker.tick(3, 2000);
    expect(tracker.take()).toEqual([{ start: 0, end: 3 }]);
  });

  test("going backwards starts a new range", () => {
    const tracker = createWatchTracker({ maxRate: 1.5 });
    tracker.tick(10, 0);
    tracker.tick(11, 1000);
    tracker.tick(5, 2000);
    tracker.tick(6, 3000);
    expect(tracker.take()).toEqual([
      { start: 10, end: 11 },
      { start: 5, end: 6 },
    ]);
  });

  test("take returns each second once and continues from the last position", () => {
    const tracker = createWatchTracker({ maxRate: 1.5 });
    tracker.tick(0, 0);
    tracker.tick(5, 5000);
    expect(tracker.take()).toEqual([{ start: 0, end: 5 }]);
    expect(tracker.take()).toEqual([]);
    tracker.tick(8, 8000);
    expect(tracker.take()).toEqual([{ start: 5, end: 8 }]);
  });

  test("ignores invalid times and reports the last position", () => {
    const tracker = createWatchTracker({ maxRate: 1.5 });
    tracker.tick(Number.NaN, 0);
    tracker.tick(-1, 0);
    expect(tracker.take()).toEqual([]);
    tracker.tick(7, 0);
    expect(tracker.position()).toBe(7);
    tracker.breakAt(Number.NaN);
    expect(tracker.position()).toBe(7);
  });

  test("a pause then resume at the same spot continues without a gap", () => {
    const tracker = createWatchTracker({ maxRate: 1.5 });
    tracker.tick(0, 0);
    tracker.tick(4, 4000);
    tracker.breakAt(4);
    expect(tracker.take()).toEqual([{ start: 0, end: 4 }]);
    tracker.tick(4, 60_000);
    tracker.tick(6, 62_000);
    expect(tracker.take()).toEqual([{ start: 4, end: 6 }]);
  });
});

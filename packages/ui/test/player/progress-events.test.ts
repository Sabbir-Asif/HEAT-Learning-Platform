import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { attachProgressEvents } from "../../src/player/progress-events";
import type { PlayerProgress } from "../../src/player/watch-tracker";

class Fake extends EventTarget {
  currentTime = 0;
  paused = false;
  visibilityState = "visible";
  fire(type: string): void {
    this.dispatchEvent(new Event(type));
  }
}

const setup = () => {
  const media = new Fake();
  const document = new Fake();
  const window = new Fake();
  const events: PlayerProgress[] = [];
  const detach = attachProgressEvents({
    media,
    document,
    window,
    maxRate: 1.5,
    intervalMs: 15_000,
    onProgress: (progress) => events.push(progress),
    now: () => Date.now(),
  });
  const advance = (seconds: number): void => {
    for (let i = 0; i < seconds; i++) {
      media.currentTime += 1;
      media.fire("timeupdate");
      vi.advanceTimersByTime(1000);
    }
  };
  return { media, document, window, events, detach, advance };
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("attachProgressEvents", () => {
  test("reports watched ranges every 15 seconds while playing", () => {
    const { events, advance, detach } = setup();
    advance(15);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      reason: "interval",
      intervals: [{ start: 1, end: 15 }],
      positionSeconds: 15,
    });
    advance(15);
    expect(events[1]?.intervals).toEqual([{ start: 15, end: 30 }]);
    detach();
  });

  test("stays quiet while nothing has been watched yet", () => {
    const { events, detach } = setup();
    vi.advanceTimersByTime(45_000);
    expect(events).toHaveLength(0);
    detach();
  });

  test("reports on pause with the ranges so far", () => {
    const { events, media, advance, detach } = setup();
    advance(5);
    media.paused = true;
    media.fire("pause");
    expect(events[0]).toEqual({
      reason: "pause",
      intervals: [{ start: 1, end: 5 }],
      positionSeconds: 5,
    });
    detach();
  });

  test("reports on seek and does not count the skipped part", () => {
    const { events, media, advance, detach } = setup();
    advance(5);
    media.currentTime = 200;
    media.fire("seeking");
    media.fire("seeked");
    advance(3);
    media.fire("ended");
    expect(events[0]).toMatchObject({ reason: "seek", positionSeconds: 200 });
    expect(events[0]?.intervals).toEqual([{ start: 1, end: 5 }]);
    expect(events[1]).toMatchObject({ reason: "ended" });
    expect(events[1]?.intervals).toEqual([{ start: 201, end: 203 }]);
    detach();
  });

  test("reports when the tab is hidden and on page hide", () => {
    const { events, document, window, advance, detach } = setup();
    advance(3);
    document.visibilityState = "hidden";
    document.fire("visibilitychange");
    advance(2);
    window.fire("pagehide");
    expect(events.map((event) => event.reason)).toEqual(["hidden", "pagehide"]);
    detach();
  });

  test("does not report when the tab becomes visible", () => {
    const { events, document, detach } = setup();
    document.fire("visibilitychange");
    expect(events).toHaveLength(0);
    detach();
  });

  test("does not record time while paused and flushes on detach", () => {
    const { events, media, advance, detach } = setup();
    advance(2);
    media.paused = true;
    media.fire("pause");
    vi.advanceTimersByTime(1000);
    media.fire("timeupdate");
    detach();
    expect(events.at(-1)?.reason).toBe("unmount");
    expect(events.at(-1)?.intervals).toEqual([]);
  });

  test("stops reporting after detach", () => {
    const { events, detach } = setup();
    detach();
    const count = events.length;
    vi.advanceTimersByTime(60_000);
    expect(events).toHaveLength(count);
  });
});

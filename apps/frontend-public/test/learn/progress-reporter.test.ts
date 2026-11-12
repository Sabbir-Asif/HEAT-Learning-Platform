import { describe, expect, test, vi } from "vitest";
import {
  createBeaconSender,
  createProgressReporter,
  maxQueuedBatches,
  retryBaseMs,
  retryDelayMs,
  retryMaxMs,
} from "../../src/learn/progress-reporter";
import type {
  ProgressReporterOptions,
  QueuedBatch,
  ReporterStorage,
} from "../../src/learn/progress-reporter";

const sessionId = "0198f1a0-0000-7000-8000-0000000000b1";
const key = "heat.progress.v1";
const accepted = { coveragePercent: 10, resumePositionSeconds: 5, completed: false };
const progress = (overrides: object = {}) => ({
  reason: "interval" as const,
  intervals: [{ start: 0, end: 5 }],
  positionSeconds: 5,
  ...overrides,
});

class MemoryStorage implements ReporterStorage {
  items = new Map<string, string>();
  getItem(name: string): string | null {
    return this.items.get(name) ?? null;
  }
  setItem(name: string, value: string): void {
    this.items.set(name, value);
  }
  removeItem(name: string): void {
    this.items.delete(name);
  }
}

class ManualTimers {
  tasks: { id: number; callback: () => void; delayMs: number }[] = [];
  private next = 1;
  set = (callback: () => void, delayMs: number): number => {
    const id = this.next++;
    this.tasks.push({ id, callback, delayMs });
    return id;
  };
  clear = (handle: unknown): void => {
    this.tasks = this.tasks.filter((task) => task.id !== handle);
  };
  fire(): void {
    const task = this.tasks.shift();
    task?.callback();
  }
}

const build = (overrides: Partial<ProgressReporterOptions> = {}) => {
  const timers = new ManualTimers();
  const storage = new MemoryStorage();
  const send = vi.fn().mockResolvedValue(accepted);
  const beacon = vi.fn().mockReturnValue(true);
  const onAccepted = vi.fn();
  const reporter = createProgressReporter({
    sessionId,
    send,
    beacon,
    isRetryable: () => true,
    storage,
    storageKey: key,
    onAccepted,
    timers,
    ...overrides,
  });
  return { reporter, send, beacon, onAccepted, storage, timers };
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createProgressReporter", () => {
  test("sends each report with an increasing sequence number", async () => {
    const { reporter, send, onAccepted } = build();
    reporter.report(progress());
    await settle();
    reporter.report(progress({ intervals: [{ start: 5, end: 10 }], positionSeconds: 10 }));
    await settle();
    expect(send.mock.calls.map((call) => (call[0] as QueuedBatch).sequence)).toEqual([1, 2]);
    expect(send.mock.calls[0]?.[0]).toEqual({
      sessionId,
      sequence: 1,
      positionSeconds: 5,
      intervals: [{ start: 0, end: 5 }],
    });
    expect(onAccepted).toHaveBeenCalledTimes(2);
    expect(reporter.pending()).toBe(0);
  });

  test("skips a report with no intervals and an unchanged position", async () => {
    const { reporter, send } = build();
    reporter.report(progress());
    await settle();
    reporter.report(progress({ intervals: [], reason: "unmount" }));
    await settle();
    expect(send).toHaveBeenCalledTimes(1);
  });

  test("sends a position-only report when the position moved", async () => {
    const { reporter, send } = build();
    reporter.report(progress({ intervals: [], positionSeconds: 0 }));
    await settle();
    reporter.report(progress({ intervals: [], positionSeconds: 40 }));
    await settle();
    expect(send).toHaveBeenCalledTimes(2);
  });

  test("keeps a failed batch in memory and storage and retries with backoff", async () => {
    const { reporter, send, storage, timers } = build();
    send.mockRejectedValueOnce(new Error("offline"));
    reporter.report(progress());
    await settle();
    expect(reporter.pending()).toBe(1);
    expect(JSON.parse(storage.getItem(key) ?? "[]")).toHaveLength(1);
    expect(timers.tasks[0]?.delayMs).toBe(retryBaseMs);
    timers.fire();
    await settle();
    expect(send).toHaveBeenCalledTimes(2);
    expect(reporter.pending()).toBe(0);
    expect(storage.getItem(key)).toBeNull();
  });

  test("sends queued batches in order after the connection returns", async () => {
    const { reporter, send, timers } = build();
    send.mockRejectedValue(new Error("offline"));
    reporter.report(progress());
    await settle();
    reporter.report(progress({ intervals: [{ start: 5, end: 20 }], positionSeconds: 20 }));
    await settle();
    reporter.report(progress({ intervals: [{ start: 20, end: 35 }], positionSeconds: 35 }));
    await settle();
    expect(reporter.pending()).toBe(3);
    send.mockReset();
    send.mockResolvedValue(accepted);
    await reporter.flush();
    expect(send.mock.calls.map((call) => (call[0] as QueuedBatch).sequence)).toEqual([1, 2, 3]);
    expect(reporter.pending()).toBe(0);
    expect(timers.tasks).toHaveLength(0);
  });

  test("backoff doubles and is capped", () => {
    expect(retryDelayMs(1)).toBe(retryBaseMs);
    expect(retryDelayMs(2)).toBe(retryBaseMs * 2);
    expect(retryDelayMs(30)).toBe(retryMaxMs);
  });

  test("drops a batch the server refuses for good and carries on", async () => {
    const { reporter, send, onAccepted } = build({ isRetryable: () => false });
    send.mockRejectedValueOnce(new Error("forbidden"));
    reporter.report(progress());
    await settle();
    expect(reporter.pending()).toBe(0);
    expect(onAccepted).not.toHaveBeenCalled();
    reporter.report(progress({ intervals: [{ start: 5, end: 10 }], positionSeconds: 10 }));
    await settle();
    expect(onAccepted).toHaveBeenCalledTimes(1);
  });

  test("hands the whole queue to the beacon on page hide", async () => {
    const { reporter, send, beacon, storage } = build();
    send.mockRejectedValue(new Error("offline"));
    reporter.report(progress());
    await settle();
    reporter.report(
      progress({ reason: "pagehide", intervals: [{ start: 5, end: 9 }], positionSeconds: 9 }),
    );
    expect(beacon).toHaveBeenCalledTimes(2);
    expect(reporter.pending()).toBe(0);
    expect(storage.getItem(key)).toBeNull();
    expect(send).toHaveBeenCalledTimes(1);
  });

  test("keeps batches the beacon refused so they survive in storage", async () => {
    const { reporter, beacon, storage } = build();
    beacon.mockReturnValue(false);
    reporter.report(progress({ reason: "pagehide" }));
    expect(reporter.pending()).toBe(1);
    expect(JSON.parse(storage.getItem(key) ?? "[]")).toHaveLength(1);
  });

  test("a page hide with nothing new still hands over what is waiting", async () => {
    const { reporter, send, beacon } = build();
    send.mockRejectedValue(new Error("offline"));
    reporter.report(progress());
    await settle();
    reporter.report(progress({ reason: "pagehide", intervals: [] }));
    expect(beacon).toHaveBeenCalledTimes(1);
  });

  test("restores stored batches on creation and sends them", async () => {
    const storage = new MemoryStorage();
    const stored: QueuedBatch = {
      sessionId: "0198f1a0-0000-7000-8000-0000000000c9",
      sequence: 4,
      positionSeconds: 30,
      intervals: [{ start: 10, end: 30 }],
    };
    storage.setItem(key, JSON.stringify([stored]));
    const { reporter, send } = build({ storage });
    expect(reporter.pending()).toBe(1);
    await reporter.flush();
    expect(send).toHaveBeenCalledWith(stored);
    expect(storage.getItem(key)).toBeNull();
  });

  test("ignores unreadable stored data", () => {
    for (const raw of ["not json", '{"a":1}', '[{"sessionId":"x"}]']) {
      const storage = new MemoryStorage();
      storage.setItem(key, raw);
      expect(build({ storage }).reporter.pending()).toBe(0);
    }
  });

  test("still works when storage is missing or throws", async () => {
    const throwing: ReporterStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    for (const storage of [null, throwing]) {
      const { reporter, send, onAccepted } = build({ storage });
      reporter.report(progress());
      await settle();
      expect(send).toHaveBeenCalledTimes(1);
      expect(onAccepted).toHaveBeenCalledTimes(1);
    }
  });

  test("caps the queue and drops the oldest batches", async () => {
    const { reporter, send } = build();
    send.mockRejectedValue(new Error("offline"));
    for (let index = 0; index < maxQueuedBatches + 5; index++) {
      reporter.report(
        progress({ intervals: [{ start: index, end: index + 0.5 }], positionSeconds: index + 1 }),
      );
    }
    await settle();
    expect(reporter.pending()).toBe(maxQueuedBatches);
  });

  test("dispose cancels a pending retry", async () => {
    const { reporter, send, timers } = build();
    send.mockRejectedValueOnce(new Error("offline"));
    reporter.report(progress());
    await settle();
    expect(timers.tasks).toHaveLength(1);
    reporter.dispose();
    expect(timers.tasks).toHaveLength(0);
  });
});

describe("createBeaconSender", () => {
  const batch: QueuedBatch = {
    sessionId,
    sequence: 2,
    positionSeconds: 9,
    intervals: [{ start: 0, end: 9 }],
  };

  test("posts the batch with the csrf token in the body", async () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    const send = createBeaconSender({
      url: "/api/videos/v1/progress",
      readToken: () => "token",
      sendBeacon,
    });
    expect(send(batch)).toBe(true);
    const [url, body] = sendBeacon.mock.calls[0] as [string, Blob];
    expect(url).toBe("/api/videos/v1/progress");
    expect(body.type).toBe("application/json");
    expect(JSON.parse(await body.text())).toEqual({ ...batch, csrfToken: "token" });
  });

  test("does not send without a token or a beacon, or when the browser refuses", () => {
    const sendBeacon = vi.fn().mockReturnValue(false);
    expect(createBeaconSender({ url: "/u", readToken: () => undefined, sendBeacon })(batch)).toBe(
      false,
    );
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(
      createBeaconSender({ url: "/u", readToken: () => "t", sendBeacon: undefined })(batch),
    ).toBe(false);
    expect(createBeaconSender({ url: "/u", readToken: () => "t", sendBeacon })(batch)).toBe(false);
    const throwing = vi.fn().mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(
      createBeaconSender({ url: "/u", readToken: () => "t", sendBeacon: throwing })(batch),
    ).toBe(false);
  });
});

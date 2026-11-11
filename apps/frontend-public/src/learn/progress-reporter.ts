import { progressBatchSchema } from "@heat/contracts";
import type { ProgressBatch, ProgressResponse } from "@heat/contracts";
import type { PlayerProgress } from "@heat/ui/player";

export const maxQueuedBatches = 200;
export const retryBaseMs = 5000;
export const retryMaxMs = 60000;

export type QueuedBatch = Omit<ProgressBatch, "csrfToken">;

export interface ReporterStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface ReporterTimers {
  set: (callback: () => void, delayMs: number) => unknown;
  clear: (handle: unknown) => void;
}

export interface ProgressReporterOptions {
  sessionId: string;
  send: (batch: QueuedBatch) => Promise<ProgressResponse>;
  beacon: (batch: QueuedBatch) => boolean;
  isRetryable: (error: unknown) => boolean;
  storage: ReporterStorage | null;
  storageKey: string;
  onAccepted?: (response: ProgressResponse) => void;
  timers?: ReporterTimers;
}

export interface ProgressReporter {
  report: (progress: PlayerProgress) => void;
  flush: () => Promise<void>;
  pending: () => number;
  dispose: () => void;
}

const queueSchema = progressBatchSchema.omit({ csrfToken: true }).array();

const defaultTimers: ReporterTimers = {
  set: (callback, delayMs) => setTimeout(callback, delayMs),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export const retryDelayMs = (failures: number): number =>
  Math.min(retryMaxMs, retryBaseMs * 2 ** Math.max(0, failures - 1));

const readQueue = (storage: ReporterStorage | null, key: string): QueuedBatch[] => {
  if (storage === null) return [];
  try {
    const raw = storage.getItem(key);
    if (raw === null) return [];
    const parsed = queueSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
};

const writeQueue = (storage: ReporterStorage | null, key: string, queue: QueuedBatch[]): void => {
  if (storage === null) return;
  try {
    if (queue.length === 0) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(queue));
  } catch {
    return;
  }
};

export const createProgressReporter = (options: ProgressReporterOptions): ProgressReporter => {
  const timers = options.timers ?? defaultTimers;
  let queue: QueuedBatch[] = readQueue(options.storage, options.storageKey);
  let sequence = 0;
  let lastPosition: number | null = null;
  let draining: Promise<void> | null = null;
  let failures = 0;
  let retryHandle: unknown = null;
  let disposed = false;

  const persist = (): void => writeQueue(options.storage, options.storageKey, queue);

  const clearRetry = (): void => {
    if (retryHandle !== null) timers.clear(retryHandle);
    retryHandle = null;
  };

  const scheduleRetry = (): void => {
    clearRetry();
    if (disposed) return;
    retryHandle = timers.set(() => {
      retryHandle = null;
      void drain();
    }, retryDelayMs(failures));
  };

  const dropHead = (batch: QueuedBatch): void => {
    queue = queue.filter((queued) => queued !== batch);
    persist();
  };

  const run = async (): Promise<void> => {
    for (;;) {
      const head = queue[0];
      if (head === undefined) {
        failures = 0;
        return;
      }
      try {
        const response = await options.send(head);
        dropHead(head);
        failures = 0;
        options.onAccepted?.(response);
      } catch (error) {
        if (!options.isRetryable(error)) {
          dropHead(head);
          continue;
        }
        failures += 1;
        scheduleRetry();
        return;
      }
    }
  };

  const drain = (): Promise<void> => {
    clearRetry();
    draining ??= run().finally(() => {
      draining = null;
    });
    return draining;
  };

  const enqueue = (batch: QueuedBatch): void => {
    queue = [...queue, batch].slice(-maxQueuedBatches);
    persist();
  };

  const handToBrowser = (): void => {
    const handed = queue.filter((batch) => options.beacon(batch));
    queue = queue.filter((batch) => !handed.includes(batch));
    persist();
  };

  const report = (progress: PlayerProgress): void => {
    const position = Math.max(0, progress.positionSeconds);
    const redundant = progress.intervals.length === 0 && position === lastPosition;
    if (!redundant) {
      lastPosition = position;
      sequence += 1;
      enqueue({
        sessionId: options.sessionId,
        sequence,
        positionSeconds: position,
        intervals: progress.intervals,
      });
    }
    if (progress.reason === "pagehide") handToBrowser();
    else if (!redundant) void drain();
  };

  return {
    report,
    flush: drain,
    pending: () => queue.length,
    dispose: () => {
      disposed = true;
      clearRetry();
    },
  };
};

export interface BeaconSenderOptions {
  url: string;
  readToken: () => string | undefined;
  sendBeacon: ((url: string, data: Blob) => boolean) | undefined;
}

export const createBeaconSender =
  (options: BeaconSenderOptions) =>
  (batch: QueuedBatch): boolean => {
    const token = options.readToken();
    if (token === undefined || options.sendBeacon === undefined) return false;
    try {
      const body = new Blob([JSON.stringify({ ...batch, csrfToken: token })], {
        type: "application/json",
      });
      return options.sendBeacon(options.url, body);
    } catch {
      return false;
    }
  };

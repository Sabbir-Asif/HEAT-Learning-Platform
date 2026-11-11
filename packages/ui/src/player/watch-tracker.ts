export interface WatchedRange {
  start: number;
  end: number;
}

export type ProgressReason =
  "interval" | "pause" | "seek" | "hidden" | "ended" | "pagehide" | "unmount";

export interface PlayerProgress {
  reason: ProgressReason;
  intervals: WatchedRange[];
  positionSeconds: number;
}

export interface WatchTracker {
  tick: (timeSeconds: number, nowMs: number) => void;
  breakAt: (timeSeconds: number) => void;
  take: () => WatchedRange[];
  position: () => number;
}

export interface WatchTrackerOptions {
  maxRate: number;
  slackSeconds?: number;
}

const defaultSlackSeconds = 1;

export const createWatchTracker = ({
  maxRate,
  slackSeconds = defaultSlackSeconds,
}: WatchTrackerOptions): WatchTracker => {
  let closed: WatchedRange[] = [];
  let open: WatchedRange | null = null;
  let lastTime = 0;
  let lastWallMs: number | null = null;

  const close = (): void => {
    if (open !== null && open.end > open.start) closed.push(open);
    open = null;
  };

  const tick = (timeSeconds: number, nowMs: number): void => {
    if (!Number.isFinite(timeSeconds) || timeSeconds < 0) return;
    const continuous =
      open !== null &&
      lastWallMs !== null &&
      timeSeconds >= lastTime &&
      timeSeconds - lastTime <= ((nowMs - lastWallMs) / 1000) * maxRate + slackSeconds;
    if (continuous && open !== null) {
      open.end = timeSeconds;
    } else {
      close();
      open = { start: timeSeconds, end: timeSeconds };
    }
    lastTime = timeSeconds;
    lastWallMs = nowMs;
  };

  const breakAt = (timeSeconds: number): void => {
    close();
    lastTime = Number.isFinite(timeSeconds) ? timeSeconds : lastTime;
    lastWallMs = null;
  };

  const take = (): WatchedRange[] => {
    const snapshot = open !== null && open.end > open.start ? [...closed, { ...open }] : closed;
    closed = [];
    if (open !== null) open = { start: open.end, end: open.end };
    return snapshot.map((range) => ({ start: range.start, end: range.end }));
  };

  return { tick, breakAt, take, position: () => lastTime };
};

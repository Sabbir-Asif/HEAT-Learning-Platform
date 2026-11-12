import { videoCompletionThreshold } from "@heat/contracts";
import type { WatchedInterval } from "@heat/contracts";

interface MsInterval {
  start: number;
  end: number;
}

const msPerSecond = 1000;

const toMs = (seconds: number): number => Math.round(seconds * msPerSecond);

const toSeconds = (ms: number): number => ms / msPerSecond;

const clampMs = (value: number, durationMs: number): number =>
  Math.min(durationMs, Math.max(0, value));

const normaliseMs = (intervals: readonly MsInterval[], durationMs: number): MsInterval[] => {
  const clamped = intervals
    .map((interval) => ({
      start: clampMs(interval.start, durationMs),
      end: clampMs(interval.end, durationMs),
    }))
    .filter((interval) => interval.end > interval.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: MsInterval[] = [];
  for (const interval of clamped) {
    const last = merged[merged.length - 1];
    if (last !== undefined && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
};

const lengthMs = (intervals: readonly MsInterval[]): number =>
  intervals.reduce((sum, interval) => sum + (interval.end - interval.start), 0);

const subtractMs = (
  incoming: readonly MsInterval[],
  covered: readonly MsInterval[],
): MsInterval[] => {
  const pieces: MsInterval[] = [];
  for (const interval of incoming) {
    let cursor = interval.start;
    for (const known of covered) {
      if (known.end <= cursor) continue;
      if (known.start >= interval.end) break;
      if (known.start > cursor) pieces.push({ start: cursor, end: known.start });
      cursor = Math.max(cursor, known.end);
      if (cursor >= interval.end) break;
    }
    if (cursor < interval.end) pieces.push({ start: cursor, end: interval.end });
  }
  return pieces;
};

const takeMs = (pieces: readonly MsInterval[], budgetMs: number): MsInterval[] => {
  const taken: MsInterval[] = [];
  let remaining = budgetMs;
  for (const piece of pieces) {
    if (remaining <= 0) break;
    const size = Math.min(piece.end - piece.start, remaining);
    taken.push({ start: piece.start, end: piece.start + size });
    remaining -= size;
  }
  return taken;
};

const fromMs = (intervals: readonly MsInterval[]): WatchedInterval[] =>
  intervals.map((interval) => ({ start: toSeconds(interval.start), end: toSeconds(interval.end) }));

const intoMs = (intervals: readonly WatchedInterval[]): MsInterval[] =>
  intervals.map((interval) => ({ start: toMs(interval.start), end: toMs(interval.end) }));

export const normaliseIntervals = (
  intervals: readonly WatchedInterval[],
  durationSeconds: number,
): WatchedInterval[] => fromMs(normaliseMs(intoMs(intervals), toMs(durationSeconds)));

export const coveredSeconds = (intervals: readonly WatchedInterval[]): number =>
  toSeconds(lengthMs(intoMs(intervals)));

export const coverageFraction = (
  intervals: readonly WatchedInterval[],
  durationSeconds: number,
): number =>
  durationSeconds <= 0 ? 0 : Math.min(1, lengthMs(intoMs(intervals)) / toMs(durationSeconds));

export const remainingBudgetSeconds = (input: {
  startedAt: Date;
  now: Date;
  maxRate: number;
  acceptedSeconds: number;
}): number => {
  const elapsed = Math.max(0, (input.now.getTime() - input.startedAt.getTime()) / msPerSecond);
  return Math.max(0, elapsed * input.maxRate - input.acceptedSeconds);
};

export interface MergeInput {
  stored: readonly WatchedInterval[];
  incoming: readonly WatchedInterval[];
  durationSeconds: number;
  budgetSeconds: number;
}

export interface MergeResult {
  merged: WatchedInterval[];
  acceptedSeconds: number;
  coverage: number;
}

export const mergeWithinBudget = (input: MergeInput): MergeResult => {
  const durationMs = toMs(input.durationSeconds);
  const stored = normaliseMs(intoMs(input.stored), durationMs);
  const incoming = normaliseMs(intoMs(input.incoming), durationMs);
  const fresh = subtractMs(incoming, stored);
  const accepted = takeMs(fresh, Math.floor(Math.max(0, input.budgetSeconds) * msPerSecond));
  const merged = normaliseMs([...stored, ...accepted], durationMs);
  return {
    merged: fromMs(merged),
    acceptedSeconds: toSeconds(lengthMs(accepted)),
    coverage: durationMs === 0 ? 0 : Math.min(1, lengthMs(merged) / durationMs),
  };
};

export const resumePositionOf = (positionSeconds: number, durationSeconds: number): number =>
  Math.floor(Math.min(Math.max(0, positionSeconds), durationSeconds));

export const restartWindowSeconds = 5;

export const startPositionOf = (resumeSeconds: number, durationSeconds: number): number =>
  durationSeconds <= 0 || resumeSeconds >= durationSeconds - restartWindowSeconds
    ? 0
    : resumeSeconds;

export interface SequenceDecision {
  advancesPosition: boolean;
  lastSequence: number;
}

export const decideSequence = (sequence: number, lastSequence: number): SequenceDecision =>
  sequence > lastSequence
    ? { advancesPosition: true, lastSequence: sequence }
    : { advancesPosition: false, lastSequence };

export const reachesCompletion = (coverage: number): boolean =>
  coverage >= videoCompletionThreshold;

import { createWatchTracker } from "./watch-tracker";
import type { PlayerProgress, ProgressReason } from "./watch-tracker";

export const progressIntervalMs = 15000;

export interface ProgressMedia {
  currentTime: number;
  paused: boolean;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

export interface ProgressTarget {
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

export interface ProgressDocument extends ProgressTarget {
  visibilityState: string;
}

export interface ProgressEventsOptions {
  media: ProgressMedia;
  document: ProgressDocument;
  window: ProgressTarget;
  maxRate: number;
  intervalMs: number;
  onProgress: (progress: PlayerProgress) => void;
  now?: () => number;
}

export const attachProgressEvents = (options: ProgressEventsOptions): (() => void) => {
  const { media, document, window, onProgress } = options;
  const now = options.now ?? Date.now;
  const tracker = createWatchTracker({ maxRate: options.maxRate });
  let touched = false;

  const emit = (reason: ProgressReason): void => {
    const intervals = tracker.take();
    if (reason === "interval" && intervals.length === 0 && !touched) return;
    touched = true;
    onProgress({ reason, intervals, positionSeconds: media.currentTime });
  };

  const onTimeUpdate = (): void => {
    if (!media.paused) tracker.tick(media.currentTime, now());
  };
  const onPause = (): void => {
    tracker.tick(media.currentTime, now());
    emit("pause");
    tracker.breakAt(media.currentTime);
  };
  const onSeeking = (): void => {
    emit("seek");
    tracker.breakAt(media.currentTime);
  };
  const onSeeked = (): void => tracker.breakAt(media.currentTime);
  const onEnded = (): void => {
    tracker.tick(media.currentTime, now());
    emit("ended");
    tracker.breakAt(media.currentTime);
  };
  const onVisibility = (): void => {
    if (document.visibilityState === "hidden") emit("hidden");
  };
  const onPageHide = (): void => emit("pagehide");
  const timer = setInterval(() => {
    if (!media.paused) tracker.tick(media.currentTime, now());
    emit("interval");
  }, options.intervalMs);

  media.addEventListener("timeupdate", onTimeUpdate);
  media.addEventListener("pause", onPause);
  media.addEventListener("seeking", onSeeking);
  media.addEventListener("seeked", onSeeked);
  media.addEventListener("ended", onEnded);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onPageHide);

  return () => {
    clearInterval(timer);
    media.removeEventListener("timeupdate", onTimeUpdate);
    media.removeEventListener("pause", onPause);
    media.removeEventListener("seeking", onSeeking);
    media.removeEventListener("seeked", onSeeked);
    media.removeEventListener("ended", onEnded);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", onPageHide);
    emit("unmount");
  };
};

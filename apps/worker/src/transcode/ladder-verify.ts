import { SEGMENT_SECONDS } from "./ladder";

const KEYFRAME_TOLERANCE_SECONDS = 0.05;
const SEGMENT_TOLERANCE_SECONDS = 0.5;

export function parseTimes(text: string): number[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(Number);
}

export function keyframesAligned(a: readonly number[], b: readonly number[]): boolean {
  return (
    a.length === b.length &&
    a.every((t, i) => Math.abs(t - (b[i] ?? Number.NaN)) <= KEYFRAME_TOLERANCE_SECONDS)
  );
}

export function parseMediaPlaylistDurations(playlist: string): number[] {
  return [...playlist.matchAll(/^#EXTINF:([0-9.]+)/gm)].map((m) => Number(m[1]));
}

export function segmentsAboutSixSeconds(durations: readonly number[]): boolean {
  if (durations.length === 0) return false;
  const last = durations.length - 1;
  return durations.every((d, i) =>
    i === last
      ? d <= SEGMENT_SECONDS + SEGMENT_TOLERANCE_SECONDS
      : Math.abs(d - SEGMENT_SECONDS) <= SEGMENT_TOLERANCE_SECONDS,
  );
}

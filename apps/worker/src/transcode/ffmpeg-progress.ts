const MICROSECONDS = 1_000_000;

export const progressArgs = ["-progress", "pipe:1", "-nostats"] as const;

export const parseProgressSeconds = (line: string): number | null => {
  const match = /^out_time_(?:us|ms)=(\d+)$/.exec(line.trim());
  return match === null ? null : Number(match[1]) / MICROSECONDS;
};

export class ProgressLineReader {
  private pending = "";

  constructor(private readonly onSeconds: (seconds: number) => void) {}

  push(chunk: string): void {
    const lines = (this.pending + chunk).split("\n");
    this.pending = lines.pop() ?? "";
    for (const line of lines) {
      const seconds = parseProgressSeconds(line);
      if (seconds !== null) this.onSeconds(seconds);
    }
  }
}

export const overallPercent = (
  index: number,
  count: number,
  encodedSeconds: number,
  durationSeconds: number,
): number => {
  const within =
    durationSeconds > 0 ? Math.min(1, Math.max(0, encodedSeconds / durationSeconds)) : 0;
  return Math.min(99, Math.floor(((index + within) / count) * 100));
};

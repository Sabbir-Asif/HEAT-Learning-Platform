import { isDay } from "../core";

export const backfillCommandName = "insights-backfill";

export const backfillUsage = `Usage: ${backfillCommandName} --from <YYYY-MM-DD> --to <YYYY-MM-DD>`;

export type BackfillArguments =
  { ok: true; from: string; to: string } | { ok: false; message: string };

const failure = (message: string): BackfillArguments => ({ ok: false, message });

const readFlag = (argv: readonly string[], name: string): string | undefined => {
  const prefix = `--${name}=`;
  const inline = argv.find((item) => item.startsWith(prefix));
  if (inline !== undefined) return inline.slice(prefix.length);
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? undefined : argv[index + 1];
};

export const parseBackfillArguments = (argv: readonly string[]): BackfillArguments => {
  const [command, ...rest] = argv;
  if (command !== backfillCommandName) return failure(backfillUsage);
  const from = readFlag(rest, "from");
  const to = readFlag(rest, "to");
  if (from === undefined || to === undefined) return failure(backfillUsage);
  if (!isDay(from) || !isDay(to))
    return failure(`Dates must be real days, YYYY-MM-DD. ${backfillUsage}`);
  if (from > to) return failure("The end day must not be before the start day.");
  return { ok: true, from, to };
};

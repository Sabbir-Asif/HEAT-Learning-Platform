import { parseBackfillArguments } from "./insights-backfill-arguments";
import type { RunRequestOutcome } from "../core";
import type { CliOutput } from "./run-cli";

export interface Backfiller {
  backfill: (from: string, to: string) => Promise<RunRequestOutcome>;
}

export const runInsightsBackfill = async (
  argv: readonly string[],
  backfiller: Backfiller,
  output: CliOutput,
): Promise<number> => {
  const parsed = parseBackfillArguments(argv);
  if (!parsed.ok) {
    output.err(`${parsed.message}\n`);
    return 2;
  }
  try {
    const outcome = await backfiller.backfill(parsed.from, parsed.to);
    if (outcome.outcome === "already-running") {
      output.err("An insights run is already running. Nothing was started.\n");
      return 1;
    }
    if (outcome.run.status !== "SUCCEEDED") {
      output.err(`Backfill failed: ${outcome.run.error ?? "unknown error"}\n`);
      return 1;
    }
    output.out(
      `Rebuilt ${parsed.from} to ${parsed.to} in Asia/Dhaka days. ${outcome.run.rowsWritten} rows changed.\n`,
    );
    return 0;
  } catch {
    output.err("Backfill failed unexpectedly. Check the database connection and try again.\n");
    return 1;
  }
};

import { describe, expect, test, vi } from "vitest";
import { parseBackfillArguments } from "../../src/cli/insights-backfill-arguments";
import { runInsightsBackfill } from "../../src/cli/insights-backfill";
import type { RunRecord } from "../../src/core";

const run = (overrides: Partial<RunRecord> = {}): RunRecord => ({
  id: "run-1",
  trigger: "BACKFILL",
  status: "SUCCEEDED",
  fromDay: "2026-11-01",
  toDay: "2026-11-05",
  requestedById: null,
  requestedAt: new Date("2026-11-13T05:00:00.000Z"),
  startedAt: null,
  heartbeatAt: null,
  finishedAt: null,
  rowsWritten: 12,
  error: null,
  ...overrides,
});

const capture = () => {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, output: { out: (t: string) => out.push(t), err: (t: string) => err.push(t) } };
};

describe("parseBackfillArguments", () => {
  test.each([
    [["insights-backfill", "--from", "2026-11-01", "--to", "2026-11-05"]],
    [["insights-backfill", "--from=2026-11-01", "--to=2026-11-05"]],
  ])("reads the range from %j", (argv) => {
    expect(parseBackfillArguments(argv)).toEqual({
      ok: true,
      from: "2026-11-01",
      to: "2026-11-05",
    });
  });

  test.each([
    [[]],
    [["other", "--from", "2026-11-01", "--to", "2026-11-05"]],
    [["insights-backfill", "--from", "2026-11-01"]],
    [["insights-backfill", "--from", "2026-02-30", "--to", "2026-03-01"]],
    [["insights-backfill", "--from", "2026-11-05", "--to", "2026-11-01"]],
  ])("rejects %j", (argv) => {
    expect(parseBackfillArguments(argv).ok).toBe(false);
  });
});

describe("runInsightsBackfill", () => {
  const argv = ["insights-backfill", "--from", "2026-11-01", "--to", "2026-11-05"];

  test("rebuilds the range and reports the rows changed", async () => {
    const { out, output } = capture();
    const backfill = vi.fn().mockResolvedValue({ outcome: "accepted", run: run() });
    expect(await runInsightsBackfill(argv, { backfill }, output)).toBe(0);
    expect(backfill).toHaveBeenCalledWith("2026-11-01", "2026-11-05");
    expect(out.join("")).toContain("12 rows changed");
  });

  test("refuses to start while another run is active", async () => {
    const { err, output } = capture();
    const backfill = vi.fn().mockResolvedValue({ outcome: "already-running", runId: "r" });
    expect(await runInsightsBackfill(argv, { backfill }, output)).toBe(1);
    expect(err.join("")).toContain("already running");
  });

  test("exits non-zero when the run fails", async () => {
    const { err, output } = capture();
    const backfill = vi.fn().mockResolvedValue({
      outcome: "accepted",
      run: run({ status: "FAILED", error: "Rebuild failed on 2026-11-02" }),
    });
    expect(await runInsightsBackfill(argv, { backfill }, output)).toBe(1);
    expect(err.join("")).toContain("Rebuild failed on 2026-11-02");
  });

  test("a bad range exits 2 without touching the database", async () => {
    const { output } = capture();
    const backfill = vi.fn();
    expect(await runInsightsBackfill(["insights-backfill"], { backfill }, output)).toBe(2);
    expect(backfill).not.toHaveBeenCalled();
  });

  test("an unexpected error gives a generic message", async () => {
    const { err, output } = capture();
    const backfill = vi.fn().mockRejectedValue(new Error("connection string leaked"));
    expect(await runInsightsBackfill(argv, { backfill }, output)).toBe(1);
    expect(err.join("")).not.toContain("leaked");
  });
});

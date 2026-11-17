import { dayOf, dayWindow, eachDay, isNightlyDue, recentDays } from "./dhaka-day";
import type { DayRebuilder } from "./day-rebuilder";
import type { InsightLogger, RunRecord, RunStore, RunTrigger } from "./insight-ports";
import { decideClaim } from "./run-lock";

export interface RunRequest {
  trigger: RunTrigger;
  fromDay: string;
  toDay: string;
  requestedById: string | null;
  startImmediately: boolean;
}

export type RunRequestOutcome =
  { outcome: "accepted"; run: RunRecord } | { outcome: "already-running"; runId: string };

export class InsightRunner {
  constructor(
    private readonly runs: RunStore,
    private readonly rebuilder: DayRebuilder,
    private readonly clock: { now(): Date },
    private readonly logger: InsightLogger,
  ) {}

  async request(request: RunRequest): Promise<RunRequestOutcome> {
    const now = this.clock.now();
    const decision = decideClaim(await this.runs.findActive(), now);
    if (decision.outcome === "already-running") {
      return { outcome: "already-running", runId: decision.runId };
    }
    if (decision.outcome === "recover") await this.runs.markAbandoned(decision.runId, now);
    const run = await this.runs.create({
      trigger: request.trigger,
      status: request.startImmediately ? "RUNNING" : "PENDING",
      fromDay: request.fromDay,
      toDay: request.toDay,
      requestedById: request.requestedById,
      now,
    });
    if (run === null) {
      const winner = await this.runs.findActive();
      return { outcome: "already-running", runId: winner?.id ?? "" };
    }
    return { outcome: "accepted", run };
  }

  async execute(run: RunRecord): Promise<RunRecord> {
    let rowsWritten = 0;
    let failedDay: string | null = null;
    try {
      for (const day of eachDay(run.fromDay, run.toDay)) {
        failedDay = day;
        const result = await this.rebuilder.rebuild(day);
        rowsWritten += result.written + result.deleted;
        await this.runs.heartbeat(run.id, this.clock.now(), rowsWritten);
      }
    } catch (error) {
      this.logger.error(
        `Insights run ${run.id} failed on ${failedDay ?? "start"}: ${error instanceof Error ? error.name : "unknown error"}`,
      );
      return this.runs.finish(
        run.id,
        { status: "FAILED", rowsWritten, error: `Rebuild failed on ${failedDay ?? "start"}` },
        this.clock.now(),
      );
    }
    this.logger.info(`Insights run ${run.id} finished, ${rowsWritten} rows changed`);
    return this.runs.finish(
      run.id,
      { status: "SUCCEEDED", rowsWritten, error: null },
      this.clock.now(),
    );
  }

  async runPending(): Promise<RunRecord | null> {
    const pending = await this.runs.findPending();
    if (pending === null) return null;
    const claimed = await this.runs.markRunning(pending.id, this.clock.now());
    if (claimed === null) return null;
    return this.execute(claimed);
  }

  async runNightlyIfDue(): Promise<RunRecord | null> {
    const now = this.clock.now();
    const alreadyStarted = await this.runs.nightlyRequestedBetween(dayWindow(dayOf(now)));
    if (!isNightlyDue(now, alreadyStarted)) return null;
    const { from, to } = recentDays(now);
    const outcome = await this.request({
      trigger: "NIGHTLY",
      fromDay: from,
      toDay: to,
      requestedById: null,
      startImmediately: true,
    });
    return outcome.outcome === "accepted" ? this.execute(outcome.run) : null;
  }

  async tick(): Promise<RunRecord | null> {
    const pending = await this.runPending();
    if (pending !== null) return pending;
    return this.runNightlyIfDue();
  }

  async backfill(fromDay: string, toDay: string): Promise<RunRequestOutcome> {
    const outcome = await this.request({
      trigger: "BACKFILL",
      fromDay,
      toDay,
      requestedById: null,
      startImmediately: true,
    });
    if (outcome.outcome === "accepted") {
      return { outcome: "accepted", run: await this.execute(outcome.run) };
    }
    return outcome;
  }
}

import { describe, expect, test } from "vitest";
import { DayRebuilder, InsightRunner, RollupAccumulator } from "../../../src/core/insights";
import type {
  ActiveRun,
  DayWindow,
  DayWritePlan,
  NewRun,
  RollupEvent,
  RollupRow,
  RollupSource,
  RollupStore,
  RunRecord,
  RunStore,
} from "../../../src/core/insights";

const dimensions = {
  courseId: "course-1",
  universityId: "uni-1",
  facultyId: "fac-1",
  departmentId: "dept-1",
  session: "2020-21",
};

const registered = (): RollupEvent => ({
  kind: "ENROLLMENT",
  moduleId: null,
  questionId: null,
  metric: "registered",
  amount: 1,
  ...dimensions,
});

class FakeSource implements RollupSource {
  windows: DayWindow[] = [];
  failOn: string | null = null;
  eventsByStart = new Map<string, RollupEvent[]>();

  readDay(window: DayWindow, emit: (events: RollupEvent[]) => void): Promise<void> {
    this.windows.push(window);
    if (this.failOn === window.start.toISOString()) return Promise.reject(new Error("boom"));
    const events = this.eventsByStart.get(window.start.toISOString()) ?? [];
    emit(events.slice(0, 1));
    emit(events.slice(1));
    return Promise.resolve();
  }
}

class FakeRollupStore implements RollupStore {
  days = new Map<string, Map<string, RollupRow>>();
  applied: Array<{ day: string; plan: DayWritePlan }> = [];

  readDay(day: string): Promise<RollupRow[]> {
    return Promise.resolve([...(this.days.get(day)?.values() ?? [])]);
  }

  applyDay(day: string, plan: DayWritePlan): Promise<void> {
    const rows = this.days.get(day) ?? new Map<string, RollupRow>();
    for (const row of plan.upserts) rows.set(row.key, row);
    for (const key of plan.deleteKeys) rows.delete(key);
    this.days.set(day, rows);
    this.applied.push({ day, plan });
    return Promise.resolve();
  }
}

class FakeRunStore implements RunStore {
  runs: RunRecord[] = [];
  nightlyToday = false;
  conflictOnCreate = false;
  counter = 0;

  findActive(): Promise<ActiveRun | null> {
    const run = this.runs.find((item) => item.status === "PENDING" || item.status === "RUNNING");
    if (run === undefined || (run.status !== "PENDING" && run.status !== "RUNNING")) {
      return Promise.resolve(null);
    }
    return Promise.resolve({
      id: run.id,
      status: run.status,
      requestedAt: run.requestedAt,
      startedAt: run.startedAt,
      heartbeatAt: run.heartbeatAt,
    });
  }

  create(input: NewRun): Promise<RunRecord | null> {
    if (this.conflictOnCreate) return Promise.resolve(null);
    this.counter += 1;
    const run: RunRecord = {
      id: `run-${this.counter}`,
      trigger: input.trigger,
      status: input.status,
      fromDay: input.fromDay,
      toDay: input.toDay,
      requestedById: input.requestedById,
      requestedAt: input.now,
      startedAt: input.status === "RUNNING" ? input.now : null,
      heartbeatAt: input.status === "RUNNING" ? input.now : null,
      finishedAt: null,
      rowsWritten: 0,
      error: null,
    };
    this.runs.push(run);
    return Promise.resolve(run);
  }

  findPending(): Promise<RunRecord | null> {
    return Promise.resolve(this.runs.find((run) => run.status === "PENDING") ?? null);
  }

  markRunning(id: string, now: Date): Promise<RunRecord | null> {
    const run = this.runs.find((item) => item.id === id && item.status === "PENDING");
    if (run === undefined) return Promise.resolve(null);
    run.status = "RUNNING";
    run.startedAt = now;
    run.heartbeatAt = now;
    return Promise.resolve(run);
  }

  markAbandoned(id: string, now: Date): Promise<void> {
    const run = this.runs.find((item) => item.id === id);
    if (run !== undefined) {
      run.status = "FAILED";
      run.finishedAt = now;
    }
    return Promise.resolve();
  }

  heartbeat(id: string, now: Date, rowsWritten: number): Promise<void> {
    const run = this.runs.find((item) => item.id === id);
    if (run !== undefined) {
      run.heartbeatAt = now;
      run.rowsWritten = rowsWritten;
    }
    return Promise.resolve();
  }

  finish(
    id: string,
    result: { status: "SUCCEEDED" | "FAILED"; rowsWritten: number; error: string | null },
    now: Date,
  ): Promise<RunRecord> {
    const run = this.runs.find((item) => item.id === id);
    if (run === undefined) return Promise.reject(new Error("missing"));
    run.status = result.status;
    run.rowsWritten = result.rowsWritten;
    run.error = result.error;
    run.finishedAt = now;
    return Promise.resolve(run);
  }

  nightlyRequestedBetween(): Promise<boolean> {
    return Promise.resolve(this.nightlyToday);
  }
}

const setup = (now: Date) => {
  const source = new FakeSource();
  const rollups = new FakeRollupStore();
  const runs = new FakeRunStore();
  const logs: string[] = [];
  const clock = {
    current: now,
    now(): Date {
      return this.current;
    },
  };
  const runner = new InsightRunner(runs, new DayRebuilder(source, rollups), clock, {
    info: (line) => logs.push(line),
    error: (line) => logs.push(line),
  });
  return { source, rollups, runs, runner, clock, logs };
};

describe("DayRebuilder", () => {
  test("running the same day twice leaves the values unchanged and writes nothing the second time", async () => {
    const { source, rollups } = setup(new Date("2026-11-13T05:00:00.000Z"));
    const rebuilder = new DayRebuilder(source, rollups);
    const start = "2026-11-12T18:00:00.000Z";
    source.eventsByStart.set(start, [registered(), registered(), registered()]);

    const first = await rebuilder.rebuild("2026-11-13");
    const snapshot = JSON.stringify([...(rollups.days.get("2026-11-13")?.values() ?? [])]);
    const second = await rebuilder.rebuild("2026-11-13");

    expect(first.written).toBe(1);
    expect(second).toEqual({ written: 0, deleted: 0, unchanged: 1 });
    expect(JSON.stringify([...(rollups.days.get("2026-11-13")?.values() ?? [])])).toBe(snapshot);
    expect(rollups.applied).toHaveLength(1);
  });

  test("reads the Dhaka day window and sums events across batches", async () => {
    const { source, rollups } = setup(new Date("2026-11-13T05:00:00.000Z"));
    source.eventsByStart.set("2026-11-12T18:00:00.000Z", [registered(), registered()]);
    await new DayRebuilder(source, rollups).rebuild("2026-11-13");
    expect(source.windows[0]?.end.toISOString()).toBe("2026-11-13T18:00:00.000Z");
    const [row] = [...(rollups.days.get("2026-11-13")?.values() ?? [])];
    expect(row?.metrics.registered).toBe(2);
  });

  test("a rebuild removes a row whose events no longer exist", async () => {
    const { source, rollups } = setup(new Date("2026-11-13T05:00:00.000Z"));
    const accumulator = new RollupAccumulator();
    accumulator.add(registered());
    rollups.days.set("2026-11-13", new Map(accumulator.result().map((row) => [row.key, row])));
    const result = await new DayRebuilder(source, rollups).rebuild("2026-11-13");
    expect(result.deleted).toBe(1);
    expect(rollups.days.get("2026-11-13")?.size).toBe(0);
  });
});

describe("InsightRunner single run", () => {
  const now = new Date("2026-11-13T05:00:00.000Z");

  test("an admin refresh is accepted as pending when nothing is running", async () => {
    const { runner, runs } = setup(now);
    const outcome = await runner.request({
      trigger: "MANUAL",
      fromDay: "2026-11-12",
      toDay: "2026-11-13",
      requestedById: "admin-1",
      startImmediately: false,
    });
    expect(outcome.outcome).toBe("accepted");
    expect(runs.runs).toHaveLength(1);
    expect(runs.runs[0]?.status).toBe("PENDING");
  });

  test("a second refresh while one is running reports already running and starts nothing", async () => {
    const { runner, runs } = setup(now);
    const request = {
      trigger: "MANUAL" as const,
      fromDay: "2026-11-12",
      toDay: "2026-11-13",
      requestedById: "admin-1",
      startImmediately: false,
    };
    await runner.request(request);
    const second = await runner.request(request);
    expect(second).toEqual({ outcome: "already-running", runId: "run-1" });
    expect(runs.runs).toHaveLength(1);
  });

  test("a lost race on the database guard also reports already running", async () => {
    const { runner, runs } = setup(now);
    runs.conflictOnCreate = true;
    const outcome = await runner.request({
      trigger: "MANUAL",
      fromDay: "2026-11-12",
      toDay: "2026-11-13",
      requestedById: null,
      startImmediately: false,
    });
    expect(outcome.outcome).toBe("already-running");
  });

  test("a stale run is marked failed and a new run starts", async () => {
    const { runner, runs, clock } = setup(now);
    await runner.request({
      trigger: "MANUAL",
      fromDay: "2026-11-12",
      toDay: "2026-11-13",
      requestedById: null,
      startImmediately: true,
    });
    clock.current = new Date(now.getTime() + 31 * 60 * 1000);
    const outcome = await runner.request({
      trigger: "MANUAL",
      fromDay: "2026-11-12",
      toDay: "2026-11-13",
      requestedById: null,
      startImmediately: false,
    });
    expect(outcome.outcome).toBe("accepted");
    expect(runs.runs[0]?.status).toBe("FAILED");
  });

  test("the worker picks up the pending run, rebuilds each day and succeeds", async () => {
    const { runner, source, runs } = setup(now);
    await runner.request({
      trigger: "MANUAL",
      fromDay: "2026-11-12",
      toDay: "2026-11-13",
      requestedById: "admin-1",
      startImmediately: false,
    });
    const finished = await runner.runPending();
    expect(finished?.status).toBe("SUCCEEDED");
    expect(source.windows).toHaveLength(2);
    expect(runs.runs[0]?.finishedAt).not.toBeNull();
  });

  test("a failing day finishes the run as failed without personal details", async () => {
    const { runner, source } = setup(now);
    source.failOn = "2026-11-11T18:00:00.000Z";
    await runner.request({
      trigger: "MANUAL",
      fromDay: "2026-11-12",
      toDay: "2026-11-13",
      requestedById: null,
      startImmediately: false,
    });
    const finished = await runner.runPending();
    expect(finished?.status).toBe("FAILED");
    expect(finished?.error).toBe("Rebuild failed on 2026-11-12");
  });

  test("with nothing pending the worker has nothing to run", async () => {
    const { runner } = setup(now);
    expect(await runner.runPending()).toBeNull();
  });
});

describe("InsightRunner nightly and backfill", () => {
  test("the nightly job does not start before 02:00 Dhaka time", async () => {
    const { runner, runs } = setup(new Date("2026-11-12T19:00:00.000Z"));
    expect(await runner.runNightlyIfDue()).toBeNull();
    expect(runs.runs).toHaveLength(0);
  });

  test("the nightly job rebuilds yesterday and today in Dhaka time at 02:00", async () => {
    const { runner, runs, source } = setup(new Date("2026-11-12T20:00:00.000Z"));
    const finished = await runner.runNightlyIfDue();
    expect(finished?.status).toBe("SUCCEEDED");
    expect(runs.runs[0]).toMatchObject({
      trigger: "NIGHTLY",
      fromDay: "2026-11-12",
      toDay: "2026-11-13",
    });
    expect(source.windows).toHaveLength(2);
  });

  test("the nightly job runs once per Dhaka day", async () => {
    const { runner, runs } = setup(new Date("2026-11-12T21:00:00.000Z"));
    runs.nightlyToday = true;
    expect(await runner.runNightlyIfDue()).toBeNull();
  });

  test("the nightly job yields to a run that is already active", async () => {
    const { runner, runs } = setup(new Date("2026-11-12T21:00:00.000Z"));
    await runner.request({
      trigger: "MANUAL",
      fromDay: "2026-11-12",
      toDay: "2026-11-13",
      requestedById: null,
      startImmediately: false,
    });
    expect(await runner.runNightlyIfDue()).toBeNull();
    expect(runs.runs).toHaveLength(1);
  });

  test("a backfill rebuilds every day of the range", async () => {
    const { runner, source } = setup(new Date("2026-11-13T05:00:00.000Z"));
    const outcome = await runner.backfill("2026-11-01", "2026-11-05");
    expect(outcome.outcome).toBe("accepted");
    expect(source.windows).toHaveLength(5);
  });

  test("a backfill reports already running when another run is active", async () => {
    const { runner } = setup(new Date("2026-11-13T05:00:00.000Z"));
    await runner.request({
      trigger: "MANUAL",
      fromDay: "2026-11-12",
      toDay: "2026-11-13",
      requestedById: null,
      startImmediately: false,
    });
    const outcome = await runner.backfill("2026-11-01", "2026-11-05");
    expect(outcome.outcome).toBe("already-running");
  });
});

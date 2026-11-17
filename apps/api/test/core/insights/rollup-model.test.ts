import { describe, expect, test } from "vitest";
import {
  RollupAccumulator,
  decideClaim,
  planDayWrite,
  rollupKey,
  staleRunMs,
} from "../../../src/core/insights";
import type { ActiveRun, RollupEvent } from "../../../src/core/insights";

const dimensions = {
  courseId: "course-1",
  universityId: "uni-1",
  facultyId: "fac-1",
  departmentId: "dept-1",
  session: "2020-21",
};

const event = (overrides: Partial<RollupEvent> = {}): RollupEvent => ({
  kind: "ENROLLMENT",
  moduleId: null,
  questionId: null,
  metric: "registered",
  amount: 1,
  ...dimensions,
  ...overrides,
});

describe("RollupAccumulator", () => {
  test("sums events of the same subject into one row", () => {
    const accumulator = new RollupAccumulator();
    accumulator.addAll([event(), event(), event({ metric: "verified" })]);
    const [row, ...rest] = accumulator.result();
    expect(rest).toEqual([]);
    expect(row?.metrics.registered).toBe(2);
    expect(row?.metrics.verified).toBe(1);
    expect(row?.metrics.completed).toBe(0);
  });

  test("keeps separate rows per department, session, module and question", () => {
    const accumulator = new RollupAccumulator();
    accumulator.addAll([
      event(),
      event({ departmentId: "dept-2" }),
      event({ session: "2021-22" }),
      event({ kind: "MODULE", moduleId: "m1", metric: "started" }),
      event({ kind: "QUESTION", moduleId: "m1", questionId: "q1", metric: "answered" }),
    ]);
    expect(accumulator.result()).toHaveLength(5);
  });

  test("returns rows in a stable order", () => {
    const first = new RollupAccumulator();
    const second = new RollupAccumulator();
    const events = [event({ departmentId: "b" }), event({ departmentId: "a" })];
    first.addAll(events);
    second.addAll([...events].reverse());
    expect(first.result().map((row) => row.key)).toEqual(second.result().map((row) => row.key));
  });

  test("drops rows whose metrics are all zero", () => {
    const accumulator = new RollupAccumulator();
    accumulator.add(event({ amount: 0 }));
    expect(accumulator.result()).toEqual([]);
  });

  test("the key covers kind, course, module, question, department and session", () => {
    expect(rollupKey(event({ kind: "QUESTION", moduleId: "m", questionId: "q" }))).toBe(
      "QUESTION|course-1|m|q|dept-1|2020-21",
    );
  });
});

describe("planDayWrite", () => {
  const rowsFor = (...events: RollupEvent[]) => {
    const accumulator = new RollupAccumulator();
    accumulator.addAll(events);
    return accumulator.result();
  };

  test("a first run upserts every row", () => {
    const next = rowsFor(event(), event({ departmentId: "dept-2" }));
    const plan = planDayWrite([], next);
    expect(plan.upserts).toHaveLength(2);
    expect(plan.deleteKeys).toEqual([]);
  });

  test("a second run with the same values changes nothing", () => {
    const next = rowsFor(event(), event({ departmentId: "dept-2" }));
    const plan = planDayWrite(next, rowsFor(event(), event({ departmentId: "dept-2" })));
    expect(plan.upserts).toEqual([]);
    expect(plan.deleteKeys).toEqual([]);
    expect(plan.unchanged).toBe(2);
  });

  test("changed values are upserted and vanished rows are deleted", () => {
    const existing = rowsFor(event(), event({ departmentId: "dept-2" }));
    const next = rowsFor(event(), event());
    const plan = planDayWrite(existing, next);
    expect(plan.upserts).toHaveLength(1);
    expect(plan.upserts[0]?.metrics.registered).toBe(2);
    expect(plan.deleteKeys).toEqual([rollupKey(event({ departmentId: "dept-2" }))]);
  });
});

describe("decideClaim", () => {
  const now = new Date("2026-11-13T10:00:00.000Z");
  const run = (idleMs: number, status: ActiveRun["status"] = "RUNNING"): ActiveRun => ({
    id: "run-1",
    status,
    requestedAt: new Date(now.getTime() - idleMs - 1000),
    startedAt: new Date(now.getTime() - idleMs - 500),
    heartbeatAt: new Date(now.getTime() - idleMs),
  });

  test("starts when nothing is active", () => {
    expect(decideClaim(null, now)).toEqual({ outcome: "start" });
  });

  test("reports already running while a recent run is active", () => {
    expect(decideClaim(run(1000), now)).toEqual({ outcome: "already-running", runId: "run-1" });
    expect(decideClaim(run(1000, "PENDING"), now)).toEqual({
      outcome: "already-running",
      runId: "run-1",
    });
  });

  test("recovers a run with no activity past the stale limit", () => {
    expect(decideClaim(run(staleRunMs + 1), now)).toEqual({ outcome: "recover", runId: "run-1" });
  });

  test("a run exactly at the limit is still running", () => {
    expect(decideClaim(run(staleRunMs), now).outcome).toBe("already-running");
  });

  test("falls back to the request time when the run never started", () => {
    const pending: ActiveRun = {
      id: "run-2",
      status: "PENDING",
      requestedAt: new Date(now.getTime() - staleRunMs - 5),
      startedAt: null,
      heartbeatAt: null,
    };
    expect(decideClaim(pending, now).outcome).toBe("recover");
  });
});

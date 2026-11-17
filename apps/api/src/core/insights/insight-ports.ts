import type { ActiveRun } from "./run-lock";
import type { DayWindow } from "./dhaka-day";
import type { DayWritePlan } from "./rollup-plan";
import type { RollupEvent, RollupRow } from "./rollup-model";

export type RunTrigger = "NIGHTLY" | "MANUAL" | "BACKFILL";
export type RunStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";

export interface RunRecord {
  id: string;
  trigger: RunTrigger;
  status: RunStatus;
  fromDay: string;
  toDay: string;
  requestedById: string | null;
  requestedAt: Date;
  startedAt: Date | null;
  heartbeatAt: Date | null;
  finishedAt: Date | null;
  rowsWritten: number;
  error: string | null;
}

export interface NewRun {
  trigger: RunTrigger;
  status: "PENDING" | "RUNNING";
  fromDay: string;
  toDay: string;
  requestedById: string | null;
  now: Date;
}

export interface RollupSource {
  readDay(window: DayWindow, emit: (events: RollupEvent[]) => void): Promise<void>;
}

export interface RollupStore {
  readDay(day: string): Promise<RollupRow[]>;
  applyDay(day: string, plan: DayWritePlan): Promise<void>;
}

export interface RunStore {
  findActive(): Promise<ActiveRun | null>;
  create(run: NewRun): Promise<RunRecord | null>;
  findPending(): Promise<RunRecord | null>;
  markRunning(id: string, now: Date): Promise<RunRecord | null>;
  markAbandoned(id: string, now: Date): Promise<void>;
  heartbeat(id: string, now: Date, rowsWritten: number): Promise<void>;
  finish(
    id: string,
    result: { status: "SUCCEEDED" | "FAILED"; rowsWritten: number; error: string | null },
    now: Date,
  ): Promise<RunRecord>;
  nightlyRequestedBetween(window: DayWindow): Promise<boolean>;
}

export interface InsightLogger {
  info(line: string): void;
  error(line: string): void;
}

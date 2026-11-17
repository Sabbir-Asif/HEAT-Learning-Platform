import { Prisma } from "@heat/db";
import type { HeatClient } from "@heat/db";
import { dayAsDate, dayFromDate } from "./dhaka-day";
import type { DayWindow } from "./dhaka-day";
import type { NewRun, RunRecord, RunStore } from "./insight-ports";
import type { ActiveRun } from "./run-lock";

interface RunRow {
  id: string;
  trigger: RunRecord["trigger"];
  status: RunRecord["status"];
  fromDay: Date;
  toDay: Date;
  requestedById: string | null;
  requestedAt: Date;
  startedAt: Date | null;
  heartbeatAt: Date | null;
  finishedAt: Date | null;
  rowsWritten: number;
  error: string | null;
}

export const toRunRecord = (row: RunRow): RunRecord => ({
  id: row.id,
  trigger: row.trigger,
  status: row.status,
  fromDay: dayFromDate(row.fromDay),
  toDay: dayFromDate(row.toDay),
  requestedById: row.requestedById,
  requestedAt: row.requestedAt,
  startedAt: row.startedAt,
  heartbeatAt: row.heartbeatAt,
  finishedAt: row.finishedAt,
  rowsWritten: row.rowsWritten,
  error: row.error,
});

const abandonedMessage = "Abandoned: no activity from the worker";

export class PrismaRunStore implements RunStore {
  constructor(private readonly database: HeatClient) {}

  async findActive(): Promise<ActiveRun | null> {
    const run = await this.database.insightRun.findFirst({
      where: { status: { in: ["PENDING", "RUNNING"] } },
      select: { id: true, status: true, requestedAt: true, startedAt: true, heartbeatAt: true },
    });
    if (run === null || (run.status !== "PENDING" && run.status !== "RUNNING")) return null;
    return { ...run, status: run.status };
  }

  async create(run: NewRun): Promise<RunRecord | null> {
    try {
      const created = await this.database.insightRun.create({
        data: {
          trigger: run.trigger,
          status: run.status,
          fromDay: dayAsDate(run.fromDay),
          toDay: dayAsDate(run.toDay),
          requestedById: run.requestedById,
          requestedAt: run.now,
          ...(run.status === "RUNNING" ? { startedAt: run.now, heartbeatAt: run.now } : {}),
        },
      });
      return toRunRecord(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return null;
      }
      throw error;
    }
  }

  async findPending(): Promise<RunRecord | null> {
    const row = await this.database.insightRun.findFirst({
      where: { status: "PENDING" },
      orderBy: { requestedAt: "asc" },
    });
    return row === null ? null : toRunRecord(row);
  }

  async markRunning(id: string, now: Date): Promise<RunRecord | null> {
    const claimed = await this.database.insightRun.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "RUNNING", startedAt: now, heartbeatAt: now },
    });
    if (claimed.count === 0) return null;
    const row = await this.database.insightRun.findUnique({ where: { id } });
    return row === null ? null : toRunRecord(row);
  }

  async markAbandoned(id: string, now: Date): Promise<void> {
    await this.database.insightRun.updateMany({
      where: { id, status: { in: ["PENDING", "RUNNING"] } },
      data: { status: "FAILED", finishedAt: now, error: abandonedMessage },
    });
  }

  async heartbeat(id: string, now: Date, rowsWritten: number): Promise<void> {
    await this.database.insightRun.update({
      where: { id },
      data: { heartbeatAt: now, rowsWritten },
    });
  }

  async finish(
    id: string,
    result: { status: "SUCCEEDED" | "FAILED"; rowsWritten: number; error: string | null },
    now: Date,
  ): Promise<RunRecord> {
    const row = await this.database.insightRun.update({
      where: { id },
      data: {
        status: result.status,
        rowsWritten: result.rowsWritten,
        error: result.error,
        finishedAt: now,
        heartbeatAt: now,
      },
    });
    return toRunRecord(row);
  }

  async nightlyRequestedBetween(window: DayWindow): Promise<boolean> {
    const count = await this.database.insightRun.count({
      where: { trigger: "NIGHTLY", requestedAt: { gte: window.start, lt: window.end } },
    });
    return count > 0;
  }
}

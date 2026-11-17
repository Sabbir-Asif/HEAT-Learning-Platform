import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import type {
  InsightRefreshResponse,
  InsightRunSummary,
  InsightStatusResponse,
} from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { AuditService } from "../audit";
import { CLOCK, DATABASE, InsightsRollupService, recentDays, toRunRecord } from "../core";
import type { Clock, RunRecord } from "../core";
import { ApiException } from "../http/api-exception";

export const toRunSummary = (run: RunRecord): InsightRunSummary => ({
  id: run.id,
  trigger: run.trigger,
  status: run.status,
  fromDay: run.fromDay,
  toDay: run.toDay,
  requestedAt: run.requestedAt.toISOString(),
  startedAt: run.startedAt?.toISOString() ?? null,
  finishedAt: run.finishedAt?.toISOString() ?? null,
  rowsWritten: run.rowsWritten,
  failed: run.status === "FAILED",
});

@Injectable()
export class InsightsRefreshService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly rollup: InsightsRollupService,
    private readonly audit: AuditService,
  ) {}

  async refresh(adminId: string): Promise<InsightRefreshResponse> {
    const { from, to } = recentDays(this.clock.now());
    const outcome = await this.rollup.request({
      trigger: "MANUAL",
      fromDay: from,
      toDay: to,
      requestedById: adminId,
      startImmediately: false,
    });
    if (outcome.outcome === "already-running") {
      throw new ApiException(HttpStatus.CONFLICT, "INSIGHTS_REFRESH_RUNNING");
    }
    this.audit.capture({
      entityId: outcome.run.id,
      after: { fromDay: outcome.run.fromDay, toDay: outcome.run.toDay },
    });
    return { run: toRunSummary(outcome.run) };
  }

  async status(): Promise<InsightStatusResponse> {
    const [active, last, lastSuccess] = await Promise.all([
      this.database.insightRun.findFirst({
        where: { status: { in: ["PENDING", "RUNNING"] } },
      }),
      this.database.insightRun.findFirst({
        where: { status: { in: ["SUCCEEDED", "FAILED"] } },
        orderBy: { finishedAt: "desc" },
      }),
      this.database.insightRun.findFirst({
        where: { status: "SUCCEEDED" },
        orderBy: { finishedAt: "desc" },
        select: { finishedAt: true },
      }),
    ]);
    return {
      running: active !== null,
      activeRun: active === null ? null : toRunSummary(toRunRecord(active)),
      lastRun: last === null ? null : toRunSummary(toRunRecord(last)),
      lastSuccessfulAt: lastSuccess?.finishedAt?.toISOString() ?? null,
    };
  }
}

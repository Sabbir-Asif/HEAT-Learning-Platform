import { Inject, Injectable } from "@nestjs/common";
import { adminOverviewStatusOrder } from "@heat/contracts";
import type { AdminOverview, AdminOverviewQuery } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { DATABASE } from "../core";
import { InsightsQueryService } from "./insights-query.service";

@Injectable()
export class AdminOverviewService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly insights: InsightsQueryService,
  ) {}

  async describe(query: AdminOverviewQuery): Promise<AdminOverview> {
    const enrollmentWhere = {
      deletedAt: null,
      ...(query.courseId === undefined ? {} : { courseId: query.courseId }),
    };
    const [grouped, oldest, certificatesIssued, quizzes] = await Promise.all([
      this.database.enrollment.groupBy({
        by: ["status"],
        where: enrollmentWhere,
        _count: { _all: true },
      }),
      this.database.enrollment.findFirst({
        where: { ...enrollmentWhere, status: "PENDING_APPROVAL" },
        orderBy: { requestedAt: "asc" },
        select: { requestedAt: true },
      }),
      this.database.certificate.count({
        where: { revokedAt: null, enrollment: enrollmentWhere },
      }),
      this.insights.quizResults(query),
    ]);
    const counts = new Map(grouped.map((row) => [row.status, row._count._all]));
    const statusCounts = adminOverviewStatusOrder.map((status) => ({
      status,
      count: counts.get(status) ?? 0,
    }));
    const pendingCount = counts.get("PENDING_APPROVAL") ?? 0;
    const oldestRequestedAt = oldest?.requestedAt ?? null;
    return {
      statusCounts,
      totalEnrollments: statusCounts.reduce((sum, row) => sum + row.count, 0),
      pending: {
        count: pendingCount,
        oldestRequestedAt: oldestRequestedAt?.toISOString() ?? null,
        oldestAgeSeconds:
          oldestRequestedAt === null
            ? null
            : Math.max(0, Math.floor((Date.now() - oldestRequestedAt.getTime()) / 1000)),
      },
      certificatesIssued,
      passRates: quizzes.rows.map((row) => ({
        moduleId: row.moduleId,
        label: row.label,
        suppressed: row.suppressed,
        students: row.attemptedStudents,
        passRate: row.passRate,
      })),
      suppressionThreshold: quizzes.suppressionThreshold,
      refreshedAt: quizzes.refreshedAt,
    };
  }
}

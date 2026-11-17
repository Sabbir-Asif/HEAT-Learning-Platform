import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import {
  insightDefaultGroupBy,
  insightMissedDefaultLimit,
  insightSeriesColumns,
  insightSuppressionThreshold,
} from "@heat/contracts";
import type {
  InsightFilters,
  InsightGroupBy,
  InsightQuery,
  InsightResult,
  InsightSeries,
  InsightFunnelResult,
  InsightMissedQuestions,
  InsightMissedQuestionsQuery,
  InsightModuleResults,
  InsightQuizResults,
} from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { DATABASE, dayFromDate } from "../core";
import type { RollupMetrics } from "../core";
import { ApiException } from "../http/api-exception";
import {
  GroupAccumulator,
  buildRollupWhere,
  isGroupByAllowed,
  toCsv,
  toFunnel,
  toInsightGroup,
} from "./insights-query";
import type { InsightGroupKind, QueryRow } from "./insights-query";
import {
  moduleLabels,
  toMissedQuestions,
  toModuleResults,
  toQuizResults,
} from "./insights-results";
import type { ModuleInfo } from "./insights-results";

const readBatchSize = 2000;
const defaultMissedLimit = insightMissedDefaultLimit;
const questionLabelLength = 120;

const timeGroupings: readonly InsightGroupBy[] = ["day", "month"];

@Injectable()
export class InsightsQueryService {
  constructor(@Inject(DATABASE) private readonly database: HeatClient) {}

  async query(series: InsightSeries, query: InsightQuery): Promise<InsightResult> {
    const groupBy = query.groupBy ?? insightDefaultGroupBy[series];
    if (!isGroupByAllowed(series, groupBy)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_REQUEST");
    }
    const totals = await this.totalsByGroup(series, query, groupBy);
    const labels = await this.labelsFor(
      groupBy,
      totals.map((group) => group.key),
    );
    const groups = totals
      .map((group) => toInsightGroup(series, group, labels.get(group.key) ?? group.key))
      .sort((a, b) =>
        timeGroupings.includes(groupBy)
          ? a.key.localeCompare(b.key)
          : a.label.localeCompare(b.label),
      );
    return {
      series,
      groupBy,
      columns: [...insightSeriesColumns[series]],
      groups,
      suppressionThreshold: insightSuppressionThreshold,
      refreshedAt: await this.refreshedAt(),
    };
  }

  async funnel(filters: InsightFilters): Promise<InsightFunnelResult> {
    const totals = await this.totalsByGroup("enrollments", filters, "all");
    return toFunnel(totals, await this.refreshedAt());
  }

  async moduleResults(filters: InsightFilters): Promise<InsightModuleResults> {
    const totals = await this.totalsByGroup("modules", filters, "module");
    const infos = await this.moduleInfos(totals.map((group) => group.key));
    return {
      rows: toModuleResults(totals, infos),
      suppressionThreshold: insightSuppressionThreshold,
      refreshedAt: await this.refreshedAt(),
    };
  }

  async quizResults(filters: InsightFilters): Promise<InsightQuizResults> {
    const totals = await this.totalsByGroup("quizzes", filters, "module");
    const moduleIds = totals.map((group) => group.key).filter((key) => key !== "");
    const infos = await this.moduleInfos(moduleIds);
    const quizzes = await this.database.$includingDeleted().quiz.findMany({
      where: { moduleId: { in: moduleIds } },
      select: { id: true, moduleId: true },
    });
    return {
      rows: toQuizResults(totals, infos, new Map(quizzes.map((quiz) => [quiz.moduleId, quiz.id]))),
      suppressionThreshold: insightSuppressionThreshold,
      refreshedAt: await this.refreshedAt(),
    };
  }

  async missedQuestions(query: InsightMissedQuestionsQuery): Promise<InsightMissedQuestions> {
    const { quizId, limit, ...filters } = query;
    const everything = this.database.$includingDeleted();
    const quiz = await everything.quiz.findUnique({
      where: { id: quizId },
      select: { id: true, moduleId: true },
    });
    if (quiz === null) throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND");
    const infos = await this.moduleInfos([quiz.moduleId]);
    const label = moduleLabels(infos, new Set([quiz.moduleId])).get(quiz.moduleId) ?? "";
    const totals = await this.totalsByGroup("questions", filters, "question", quiz.moduleId);
    const questions = await everything.question.findMany({
      where: { quizId: quiz.id },
      select: { id: true, order: true, text: true },
    });
    const { rows, suppressedCount } = toMissedQuestions(
      totals,
      questions,
      limit ?? defaultMissedLimit,
    );
    return {
      quizId: quiz.id,
      label,
      rows,
      suppressedCount,
      suppressionThreshold: insightSuppressionThreshold,
      refreshedAt: await this.refreshedAt(),
    };
  }

  async csv(series: InsightSeries, query: InsightQuery): Promise<string> {
    const result = await this.query(series, query);
    return toCsv(result.columns, result.groups);
  }

  private async totalsByGroup(
    series: InsightSeries,
    query: InsightFilters,
    groupBy: InsightGroupKind,
    moduleId?: string,
  ) {
    const where = buildRollupWhere(series, query, moduleId);
    const accumulator = new GroupAccumulator(groupBy);
    let cursor: string | undefined;
    for (;;) {
      const rows = await this.database.insightRollup.findMany({
        where,
        orderBy: { id: "asc" },
        take: readBatchSize,
        ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
      });
      for (const row of rows) {
        const metrics: RollupMetrics = {
          registered: row.registered,
          verified: row.verified,
          approved: row.approved,
          started: row.started,
          quizReady: row.quizReady,
          completed: row.completed,
          attempts: row.attempts,
          passedAttempts: row.passedAttempts,
          attemptedStudents: row.attemptedStudents,
          passedStudents: row.passedStudents,
          answered: row.answered,
          missed: row.missed,
          askedStudents: row.askedStudents,
        };
        const queryRow: QueryRow = {
          day: dayFromDate(row.day),
          courseId: row.courseId,
          moduleId: row.moduleId,
          questionId: row.questionId,
          universityId: row.universityId,
          facultyId: row.facultyId,
          departmentId: row.departmentId,
          session: row.session,
          metrics,
        };
        accumulator.add(queryRow);
      }
      const last = rows.at(-1);
      if (last === undefined || rows.length < readBatchSize) break;
      cursor = last.id;
    }
    return accumulator.result();
  }

  private async moduleInfos(moduleIds: readonly string[]): Promise<ModuleInfo[]> {
    const ids = moduleIds.filter((id) => id !== "");
    if (ids.length === 0) return [];
    const everything = this.database.$includingDeleted();
    const seeds = await everything.module.findMany({
      where: { id: { in: ids } },
      select: { revisionId: true },
    });
    const modules = await everything.module.findMany({
      where: { revisionId: { in: [...new Set(seeds.map((seed) => seed.revisionId))] } },
      select: {
        id: true,
        order: true,
        title: true,
        deletedAt: true,
        revisionId: true,
        revision: {
          select: { number: true, courseId: true, course: { select: { title: true } } },
        },
      },
    });
    return modules.map((row) => ({
      id: row.id,
      order: row.order,
      title: row.title,
      deleted: row.deletedAt !== null,
      revisionId: row.revisionId,
      revisionNumber: row.revision.number,
      courseId: row.revision.courseId,
      courseTitle: row.revision.course.title,
    }));
  }

  private async labelsFor(
    groupBy: InsightGroupBy,
    keys: readonly string[],
  ): Promise<Map<string, string>> {
    const ids = keys.filter((key) => key !== "");
    const everything = this.database.$includingDeleted();
    switch (groupBy) {
      case "course": {
        const rows = await everything.course.findMany({
          where: { id: { in: ids } },
          select: { id: true, title: true },
        });
        return new Map(rows.map((row) => [row.id, row.title]));
      }
      case "module": {
        const rows = await everything.module.findMany({
          where: { id: { in: ids } },
          select: { id: true, title: true },
        });
        return new Map(rows.map((row) => [row.id, row.title]));
      }
      case "question": {
        const rows = await everything.question.findMany({
          where: { id: { in: ids } },
          select: { id: true, text: true },
        });
        return new Map(rows.map((row) => [row.id, row.text.slice(0, questionLabelLength)]));
      }
      case "university": {
        const rows = await this.database.university.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        });
        return new Map(rows.map((row) => [row.id, row.name]));
      }
      case "faculty": {
        const rows = await this.database.faculty.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        });
        return new Map(rows.map((row) => [row.id, row.name]));
      }
      case "department": {
        const rows = await this.database.department.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        });
        return new Map(rows.map((row) => [row.id, row.name]));
      }
      case "day":
      case "month":
      case "session":
        return new Map();
    }
  }

  private async refreshedAt(): Promise<string | null> {
    const run = await this.database.insightRun.findFirst({
      where: { status: "SUCCEEDED" },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true },
    });
    return run?.finishedAt?.toISOString() ?? null;
  }
}

import type { HeatClient } from "@heat/db";
import { dayAsDate } from "./dhaka-day";
import type { RollupStore } from "./insight-ports";
import { emptyMetrics, rollupMetrics } from "./rollup-model";
import type { RollupRow } from "./rollup-model";
import type { DayWritePlan } from "./rollup-plan";

const transactionTimeoutMs = 60000;

const metricData = (row: RollupRow): Record<(typeof rollupMetrics)[number], number> => {
  const data = emptyMetrics();
  for (const metric of rollupMetrics) data[metric] = row.metrics[metric];
  return data;
};

export class PrismaRollupStore implements RollupStore {
  constructor(private readonly database: HeatClient) {}

  async readDay(day: string): Promise<RollupRow[]> {
    const rows = await this.database.insightRollup.findMany({ where: { day: dayAsDate(day) } });
    return rows.map((row) => ({
      key: row.key,
      kind: row.kind,
      courseId: row.courseId,
      moduleId: row.moduleId,
      questionId: row.questionId,
      universityId: row.universityId,
      facultyId: row.facultyId,
      departmentId: row.departmentId,
      session: row.session,
      metrics: {
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
      },
    }));
  }

  applyDay(day: string, plan: DayWritePlan): Promise<void> {
    const date = dayAsDate(day);
    return this.database.$transaction(
      async (tx) => {
        for (const row of plan.upserts) {
          const fields = {
            kind: row.kind,
            courseId: row.courseId,
            moduleId: row.moduleId,
            questionId: row.questionId,
            universityId: row.universityId,
            facultyId: row.facultyId,
            departmentId: row.departmentId,
            session: row.session,
            ...metricData(row),
          };
          await tx.insightRollup.upsert({
            where: { day_key: { day: date, key: row.key } },
            create: { day: date, key: row.key, ...fields },
            update: fields,
          });
        }
        if (plan.deleteKeys.length > 0) {
          await tx.insightRollup.deleteMany({
            where: { day: date, key: { in: plan.deleteKeys } },
          });
        }
      },
      { timeout: transactionTimeoutMs },
    );
  }
}

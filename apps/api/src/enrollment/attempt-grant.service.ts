import { Inject, Injectable } from "@nestjs/common";
import type { GrantedAttempt } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { AuditService } from "../audit";
import { CLOCK, DATABASE } from "../core";
import type { Clock } from "../core";
import { ApiException } from "../http/api-exception";
import { attemptGrantRefusal } from "./attempt-grant-rules";
import type { AdminActor } from "./enrollment-approval.service";

@Injectable()
export class AttemptGrantService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly audit: AuditService,
  ) {}

  grant(
    enrollmentId: string,
    quizId: string,
    actor: AdminActor,
    reason: string | undefined,
  ): Promise<GrantedAttempt> {
    return this.database.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.findFirst({
        where: { id: enrollmentId, deletedAt: null },
        select: { id: true, status: true, userId: true, courseRevisionId: true },
      });
      if (enrollment === null || enrollment.courseRevisionId === null) {
        throw new ApiException(404, "NOT_FOUND");
      }
      await tx.$queryRaw`SELECT id FROM "Enrollment" WHERE id = ${enrollment.id}::uuid FOR UPDATE`;
      const quiz = await tx.quiz.findFirst({
        where: {
          id: quizId,
          deletedAt: null,
          module: { revisionId: enrollment.courseRevisionId, deletedAt: null },
        },
        select: { id: true, attemptLimit: true, waitMinutes: true },
      });
      if (quiz === null) throw new ApiException(404, "NOT_FOUND");
      const [submitted, grants] = await Promise.all([
        tx.quizAttempt.findMany({
          where: { enrollmentId, quizId, submittedAt: { not: null } },
          select: { passed: true, submittedAt: true },
        }),
        tx.attemptGrant.findMany({
          where: { enrollmentId, quizId },
          select: { extraAttempts: true },
        }),
      ]);
      const extraAttempts = grants.reduce((sum, row) => sum + row.extraAttempts, 0);
      const refusal = attemptGrantRefusal(
        {
          enrollmentStatus: enrollment.status,
          attemptLimit: quiz.attemptLimit,
          waitMinutes: quiz.waitMinutes,
          extraAttempts,
          attempts: submitted.flatMap((row) =>
            row.submittedAt === null ? [] : [{ passed: row.passed, submittedAt: row.submittedAt }],
          ),
        },
        this.clock.now(),
      );
      if (refusal !== null) throw refusal;
      const created = await tx.attemptGrant.create({
        data: {
          enrollmentId,
          quizId,
          adminId: actor.actorId,
          extraAttempts: 1,
          grantedAt: this.clock.now(),
          ...(reason === undefined ? {} : { reason }),
        },
        select: { id: true },
      });
      await this.audit.record(tx, actor, {
        action: "quiz.attempt_grant",
        entity: "AttemptGrant",
        entityId: created.id,
        after: {
          enrollmentId,
          studentId: enrollment.userId,
          quizId,
          ...(reason === undefined ? {} : { reason }),
        },
      });
      return { id: created.id, quizId, grantedAttempts: extraAttempts + 1 };
    });
  }
}

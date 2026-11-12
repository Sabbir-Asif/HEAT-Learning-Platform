import { Inject, Injectable } from "@nestjs/common";
import type { ReinstatedEnrollment, RemovedEnrollment } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { AuditService } from "../audit";
import { CLOCK, DATABASE } from "../core";
import type { Clock } from "../core";
import { ApiException } from "../http/api-exception";
import type { AdminActor } from "./enrollment-approval.service";
import { reinstatementTarget, removalRefusal } from "./removal-rules";

export const ENROLLMENT_REMOVED_EVENT_TYPE = "EnrollmentRemoved";
export const ENROLLMENT_REINSTATED_EVENT_TYPE = "EnrollmentReinstated";

type RemovalTransaction = Pick<HeatClient, "enrollment" | "enrollmentDecision" | "outbox">;

const enrollmentSelect = {
  id: true,
  status: true,
  statusBeforeRemoval: true,
  courseId: true,
  userId: true,
} as const;

@Injectable()
export class EnrollmentRemovalService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly audit: AuditService,
  ) {}

  remove(id: string, actor: AdminActor, reason: string): Promise<RemovedEnrollment> {
    return this.database.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.findFirst({
        where: { id, deletedAt: null },
        select: enrollmentSelect,
      });
      if (enrollment === null) throw new ApiException(404, "NOT_FOUND");
      const refusal = removalRefusal(enrollment.status);
      if (refusal !== null) throw refusal;
      const now = this.clock.now();
      const claimed = await tx.enrollment.updateMany({
        where: { id, status: enrollment.status },
        data: { status: "REMOVED", statusBeforeRemoval: enrollment.status, removedAt: now },
      });
      if (claimed.count === 0) await this.refuseLostClaim(tx, id);
      await this.recordDecision(tx, id, actor, "REMOVE", now, reason);
      await tx.outbox.create({
        data: {
          eventType: ENROLLMENT_REMOVED_EVENT_TYPE,
          payload: {
            enrollmentId: id,
            userId: enrollment.userId,
            courseId: enrollment.courseId,
            reason,
          },
        },
      });
      await this.audit.record(tx, actor, {
        action: "enrollment.remove",
        entity: "Enrollment",
        entityId: id,
        before: { status: enrollment.status },
        after: { status: "REMOVED", reason },
      });
      return { id, status: "REMOVED", removedAt: now.toISOString() };
    });
  }

  reinstate(id: string, actor: AdminActor, reason?: string): Promise<ReinstatedEnrollment> {
    return this.database.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.findFirst({
        where: { id, deletedAt: null },
        select: enrollmentSelect,
      });
      if (enrollment === null) throw new ApiException(404, "NOT_FOUND");
      const target = reinstatementTarget(enrollment.status, enrollment.statusBeforeRemoval);
      const now = this.clock.now();
      const claimed = await tx.enrollment.updateMany({
        where: { id, status: "REMOVED" },
        data: { status: target, statusBeforeRemoval: null, removedAt: null },
      });
      if (claimed.count === 0) await this.refuseLostClaim(tx, id);
      await this.recordDecision(tx, id, actor, "REINSTATE", now, reason);
      await tx.outbox.create({
        data: {
          eventType: ENROLLMENT_REINSTATED_EVENT_TYPE,
          payload: {
            enrollmentId: id,
            userId: enrollment.userId,
            courseId: enrollment.courseId,
            status: target,
            ...(reason === undefined ? {} : { reason }),
          },
        },
      });
      await this.audit.record(tx, actor, {
        action: "enrollment.reinstate",
        entity: "Enrollment",
        entityId: id,
        before: { status: "REMOVED" },
        after: { status: target, ...(reason === undefined ? {} : { reason }) },
      });
      return { id, status: target };
    });
  }

  private recordDecision(
    tx: RemovalTransaction,
    enrollmentId: string,
    actor: AdminActor,
    action: "REMOVE" | "REINSTATE",
    decidedAt: Date,
    reason: string | undefined,
  ) {
    return tx.enrollmentDecision.create({
      data: {
        enrollmentId,
        adminId: actor.actorId,
        action,
        ...(reason === undefined ? {} : { reason }),
        decidedAt,
      },
    });
  }

  private async refuseLostClaim(tx: RemovalTransaction, id: string): Promise<never> {
    const current = await tx.enrollment.findFirst({ where: { id }, select: { status: true } });
    if (current === null) throw new ApiException(404, "NOT_FOUND");
    throw new ApiException(409, "ENROLLMENT_STATE_CHANGED");
  }
}

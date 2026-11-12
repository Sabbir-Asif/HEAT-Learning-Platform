import { Inject, Injectable } from "@nestjs/common";
import type { BulkRejectionResponse, RejectedEnrollment } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { AuditService } from "../audit";
import { CLOCK, DATABASE } from "../core";
import type { Clock } from "../core";
import { ApiException } from "../http/api-exception";
import { NotificationsService } from "../notifications";
import type { NotificationWriter } from "../notifications";
import {
  decisionEmailPayload,
  ENROLLMENT_REJECTED_TEMPLATE,
  readDecisionEmailSnapshot,
} from "./decision-email";
import { approvalRefusal } from "./approval-rules";
import type { EnrollmentStatusName } from "./approval-rules";
import type { AdminActor } from "./enrollment-approval.service";

export const ENROLLMENT_REJECTED_EVENT_TYPE = "EnrollmentRejected";

type RejectionTransaction = Pick<
  HeatClient,
  | "enrollment"
  | "user"
  | "course"
  | "studentProfile"
  | "session"
  | "enrollmentDecision"
  | "outbox"
  | "auditLog"
> &
  NotificationWriter;

@Injectable()
export class EnrollmentRejectionService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  reject(id: string, actor: AdminActor, reason?: string): Promise<RejectedEnrollment> {
    return this.database.$transaction((tx) => this.rejectWithin(tx, id, actor, reason));
  }

  async rejectMany(
    ids: string[],
    actor: AdminActor,
    reason?: string,
  ): Promise<BulkRejectionResponse> {
    const summary: BulkRejectionResponse = { succeeded: [], failed: [] };
    for (const id of ids) {
      try {
        await this.reject(id, actor, reason);
        summary.succeeded.push(id);
      } catch (error) {
        summary.failed.push({ id, code: error instanceof ApiException ? error.code : "INTERNAL" });
      }
    }
    return summary;
  }

  private async rejectWithin(
    tx: RejectionTransaction,
    id: string,
    actor: AdminActor,
    reason: string | undefined,
  ): Promise<RejectedEnrollment> {
    const enrollment = await tx.enrollment.findFirst({
      where: { id },
      select: { id: true, status: true, courseId: true, userId: true },
    });
    if (enrollment === null) throw new ApiException(404, "NOT_FOUND");
    const refusal = approvalRefusal(enrollment.status);
    if (refusal !== null) throw refusal;
    const now = this.clock.now();
    const claimed = await tx.enrollment.updateMany({
      where: { id, status: "PENDING_APPROVAL" },
      data: { status: "REJECTED", rejectedAt: now },
    });
    if (claimed.count === 0) await this.refuseLostClaim(tx, id);
    const snapshot = await readDecisionEmailSnapshot(tx, enrollment.userId, enrollment.courseId);
    await tx.enrollmentDecision.create({
      data: {
        enrollmentId: id,
        adminId: actor.actorId,
        action: "REJECT",
        ...(reason === undefined ? {} : { reason }),
        decidedAt: now,
      },
    });
    await tx.enrollment.delete({ where: { id } });
    const otherAccess = await tx.enrollment.count({
      where: {
        userId: enrollment.userId,
        id: { not: id },
        status: { in: ["APPROVED", "COMPLETED"] },
      },
    });
    const accountDeleted = otherAccess === 0;
    if (accountDeleted) {
      await tx.studentProfile.deleteMany({ where: { userId: enrollment.userId } });
      await tx.user.delete({ where: { id: enrollment.userId } });
      await tx.session.updateMany({
        where: { userId: enrollment.userId, revokedAt: null },
        data: { revokedAt: now },
      });
    }
    await tx.outbox.create({
      data: {
        eventType: ENROLLMENT_REJECTED_EVENT_TYPE,
        payload: {
          ...decisionEmailPayload(ENROLLMENT_REJECTED_TEMPLATE, snapshot),
          enrollmentId: id,
          userId: enrollment.userId,
          courseId: enrollment.courseId,
          ...(reason === undefined ? {} : { reason }),
        },
      },
    });
    if (!accountDeleted) {
      await this.notifications.createWithin(tx, {
        userId: enrollment.userId,
        type: "ENROLLMENT_REJECTED",
        data: { enrollmentId: id, courseId: enrollment.courseId },
      });
    }
    await this.audit.record(tx, actor, {
      action: "enrollment.reject",
      entity: "Enrollment",
      entityId: id,
      before: { status: enrollment.status },
      after: {
        status: "REJECTED",
        accountDeleted,
        ...(reason === undefined ? {} : { reason }),
      },
    });
    return { id, status: "REJECTED", rejectedAt: now.toISOString(), accountDeleted };
  }

  private async refuseLostClaim(tx: RejectionTransaction, id: string): Promise<never> {
    const current = await tx.enrollment.findFirst({ where: { id }, select: { status: true } });
    const refusal =
      current === null ? null : approvalRefusal(current.status as EnrollmentStatusName);
    throw refusal ?? new ApiException(409, "ENROLLMENT_ALREADY_DECIDED");
  }
}

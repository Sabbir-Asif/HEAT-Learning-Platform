import { Inject, Injectable } from "@nestjs/common";
import type { ApprovedEnrollment, BulkApprovalResponse } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { AuditService } from "../audit";
import type { AuditActor } from "../audit";
import { ContentLockService, CourseLookupService } from "../catalog";
import type { ContentLockTransaction } from "../catalog";
import { CLOCK, DATABASE } from "../core";
import type { Clock } from "../core";
import { ApiException } from "../http/api-exception";
import { NotificationsService } from "../notifications";
import type { NotificationWriter } from "../notifications";
import {
  decisionEmailPayload,
  ENROLLMENT_APPROVED_TEMPLATE,
  readDecisionEmailSnapshot,
} from "./decision-email";
import { approvalRefusal } from "./approval-rules";
import type { EnrollmentStatusName } from "./approval-rules";

export const ENROLLMENT_APPROVED_EVENT_TYPE = "EnrollmentApproved";

export type AdminActor = AuditActor & { actorId: string };

type ApprovalTransaction = ContentLockTransaction &
  Pick<
    HeatClient,
    | "enrollment"
    | "moduleProgress"
    | "enrollmentDecision"
    | "outbox"
    | "auditLog"
    | "courseRevision"
    | "user"
    | "course"
  > &
  NotificationWriter;

@Injectable()
export class EnrollmentApprovalService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly courses: CourseLookupService,
    private readonly locks: ContentLockService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  approve(id: string, actor: AdminActor, reason?: string): Promise<ApprovedEnrollment> {
    return this.database.$transaction((tx) => this.approveWithin(tx, id, actor, reason));
  }

  async approveMany(
    ids: string[],
    actor: AdminActor,
    reason?: string,
  ): Promise<BulkApprovalResponse> {
    const summary: BulkApprovalResponse = { succeeded: [], failed: [] };
    for (const id of ids) {
      try {
        await this.approve(id, actor, reason);
        summary.succeeded.push(id);
      } catch (error) {
        summary.failed.push({ id, code: error instanceof ApiException ? error.code : "INTERNAL" });
      }
    }
    return summary;
  }

  private async approveWithin(
    tx: ApprovalTransaction,
    id: string,
    actor: AdminActor,
    reason: string | undefined,
  ): Promise<ApprovedEnrollment> {
    const enrollment = await tx.enrollment.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true, courseId: true, userId: true },
    });
    if (enrollment === null) throw new ApiException(404, "NOT_FOUND");
    const refusal = approvalRefusal(enrollment.status);
    if (refusal !== null) throw refusal;
    const target = await this.courses.resolveApprovalTarget(enrollment.courseId, tx);
    const now = this.clock.now();
    const claimed = await tx.enrollment.updateMany({
      where: { id, status: "PENDING_APPROVAL" },
      data: { status: "APPROVED", courseRevisionId: target.revisionId, approvedAt: now },
    });
    if (claimed.count === 0) await this.refuseLostClaim(tx, id);
    await this.locks.lockOnFirstApproval(tx, enrollment.courseId, now);
    await tx.moduleProgress.createMany({
      data: target.moduleIds.map((moduleId, index) =>
        index === 0
          ? { enrollmentId: id, moduleId, status: "UNLOCKED" as const, unlockedAt: now }
          : { enrollmentId: id, moduleId, status: "LOCKED" as const },
      ),
    });
    await tx.enrollmentDecision.create({
      data: {
        enrollmentId: id,
        adminId: actor.actorId,
        action: "APPROVE",
        ...(reason === undefined ? {} : { reason }),
        decidedAt: now,
      },
    });
    const snapshot = await readDecisionEmailSnapshot(tx, enrollment.userId, enrollment.courseId);
    await tx.outbox.create({
      data: {
        eventType: ENROLLMENT_APPROVED_EVENT_TYPE,
        payload: {
          ...decisionEmailPayload(ENROLLMENT_APPROVED_TEMPLATE, snapshot),
          enrollmentId: id,
          userId: enrollment.userId,
          courseId: enrollment.courseId,
        },
      },
    });
    await this.notifications.createWithin(tx, {
      userId: enrollment.userId,
      type: "ENROLLMENT_APPROVED",
      data: { enrollmentId: id, courseId: enrollment.courseId },
    });
    await this.audit.record(tx, actor, {
      action: "enrollment.approve",
      entity: "Enrollment",
      entityId: id,
      before: { status: enrollment.status },
      after: {
        status: "APPROVED",
        courseRevisionId: target.revisionId,
        ...(reason === undefined ? {} : { reason }),
      },
    });
    return {
      id,
      status: "APPROVED",
      courseRevisionId: target.revisionId,
      approvedAt: now.toISOString(),
    };
  }

  private async refuseLostClaim(tx: ApprovalTransaction, id: string): Promise<never> {
    const current = await tx.enrollment.findFirst({
      where: { id },
      select: { status: true },
    });
    const refusal =
      current === null ? null : approvalRefusal(current.status as EnrollmentStatusName);
    throw refusal ?? new ApiException(409, "ENROLLMENT_ALREADY_DECIDED");
  }
}

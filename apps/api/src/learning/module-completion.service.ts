import type { LearningModuleState } from "@heat/contracts";
import { Injectable } from "@nestjs/common";
import { ApiException } from "../http/api-exception";
import { planCompletion } from "./module-completion-rules";
import type { QuizScoredEvent, QuizScoredHandler } from "./quiz-scored-handler";

export const CERTIFICATE_REQUESTED_EVENT_TYPE = "certificate.requested";

@Injectable()
export class ModuleCompletionService implements QuizScoredHandler {
  async onQuizScored(event: QuizScoredEvent): Promise<void> {
    if (!event.result.passed) return;
    const { tx, enrollmentId, moduleId } = event;
    const enrollment = await tx.enrollment.findFirst({
      where: { id: enrollmentId },
      select: { status: true, courseRevisionId: true },
    });
    if (enrollment === null || enrollment.courseRevisionId === null) {
      throw new ApiException(403, "ENROLLMENT_NOT_ACTIVE");
    }
    const modules = await tx.module.findMany({
      where: { revisionId: enrollment.courseRevisionId, deletedAt: null },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    const moduleIds = modules.map((entry) => entry.id);
    const progress = await tx.moduleProgress.findMany({
      where: { enrollmentId, moduleId: { in: moduleIds } },
      select: { moduleId: true, status: true },
    });
    const stored = new Map<string, LearningModuleState>(
      progress.map((row) => [row.moduleId, row.status]),
    );
    const plan = planCompletion({ moduleIds, stored, moduleId, scoredPassed: true });
    const now = new Date();
    if (plan.completeModule) {
      const updated = await tx.moduleProgress.updateMany({
        where: { enrollmentId, moduleId, status: { not: "COMPLETED" } },
        data: { status: "COMPLETED", completedAt: now },
      });
      if (updated.count === 0 && !stored.has(moduleId)) {
        await tx.moduleProgress.create({
          data: { enrollmentId, moduleId, status: "COMPLETED", completedAt: now },
        });
      }
    }
    if (plan.unlockModuleId !== null) {
      const unlocked = await tx.moduleProgress.updateMany({
        where: { enrollmentId, moduleId: plan.unlockModuleId, status: "LOCKED" },
        data: { status: "UNLOCKED", unlockedAt: now },
      });
      if (unlocked.count === 0 && !stored.has(plan.unlockModuleId)) {
        await tx.moduleProgress.create({
          data: {
            enrollmentId,
            moduleId: plan.unlockModuleId,
            status: "UNLOCKED",
            unlockedAt: now,
          },
        });
      }
    }
    if (plan.completeCourse && enrollment.status === "APPROVED") {
      const completed = await tx.enrollment.updateMany({
        where: { id: enrollmentId, status: "APPROVED" },
        data: { status: "COMPLETED", completedAt: now },
      });
      if (completed.count === 1) {
        await tx.outbox.create({
          data: {
            eventType: CERTIFICATE_REQUESTED_EVENT_TYPE,
            payload: { enrollmentId, userId: event.userId, courseId: event.courseId },
          },
        });
      }
    }
  }
}

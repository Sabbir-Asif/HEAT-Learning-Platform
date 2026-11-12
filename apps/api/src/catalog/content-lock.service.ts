import { Injectable } from "@nestjs/common";
import { lockScope } from "./content-access";
import type { ContentLocker } from "./content-access";

export type ContentLockTransaction = ContentLocker;

@Injectable()
export class ContentLockService {
  async lockOnFirstApproval(
    tx: ContentLockTransaction,
    courseId: string,
    now: Date,
  ): Promise<boolean> {
    const scope = await lockScope(tx, courseId);
    if (scope.lockedAt !== null) return false;
    await tx.course.update({ where: { id: courseId }, data: { lockedAt: now } });
    return true;
  }
}

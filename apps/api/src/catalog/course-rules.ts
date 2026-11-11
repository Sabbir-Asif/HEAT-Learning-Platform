import type { CourseStatus } from "@heat/contracts";
import { ApiException } from "../http/api-exception";

export const assertCanPublish = (status: CourseStatus): void => {
  if (status !== "DRAFT") throw new ApiException(409, "COURSE_NOT_DRAFT");
};

export const assertCanDelete = (course: {
  status: CourseStatus;
  enrollmentCount: number;
}): void => {
  if (course.enrollmentCount > 0) throw new ApiException(409, "COURSE_HAS_ENROLLMENTS");
  if (course.status !== "DRAFT") throw new ApiException(409, "COURSE_NOT_DRAFT");
};

export const assertLockedEditAllowed = (
  before: { title: string; slug: string; lockedAt: Date | null },
  request: { title: string; slug: string },
): void => {
  if (before.lockedAt === null) return;
  if (before.title !== request.title || before.slug !== request.slug) {
    throw new ApiException(409, "COURSE_LOCKED");
  }
};

export const publishChecksFailed = (failures: string[]): ApiException =>
  new ApiException(422, "COURSE_PUBLISH_CHECKS_FAILED", undefined, undefined, undefined, failures);

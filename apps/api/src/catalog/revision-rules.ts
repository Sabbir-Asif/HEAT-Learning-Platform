import type { CourseRevisionStatus, CourseStatus } from "@heat/contracts";
import { ApiException } from "../http/api-exception";

export const revisionStatus = (publishedAt: Date | null): CourseRevisionStatus =>
  publishedAt === null ? "DRAFT" : "PUBLISHED";

export const revisionLocked = (revision: {
  publishedAt: Date | null;
  enrollmentCount: number;
  latest: boolean;
}): boolean => revision.publishedAt !== null && (revision.enrollmentCount > 0 || !revision.latest);

export const assertCanCloneRevision = (latest: { publishedAt: Date | null }): void => {
  if (latest.publishedAt === null) throw new ApiException(409, "COURSE_REVISION_DRAFT_EXISTS");
};

export const assertCanPublishRevision = (input: {
  courseStatus: CourseStatus;
  requestedId: string;
  latest: { id: string; publishedAt: Date | null };
}): void => {
  if (input.courseStatus !== "PUBLISHED") throw new ApiException(409, "COURSE_NOT_PUBLISHED");
  if (input.latest.id !== input.requestedId || input.latest.publishedAt !== null) {
    throw new ApiException(409, "COURSE_REVISION_NOT_DRAFT");
  }
};

export const assertCanDeleteRevision = (input: {
  requestedId: string;
  latest: { id: string; publishedAt: Date | null };
  enrollmentCount: number;
  revisionCount: number;
}): void => {
  if (
    input.latest.id !== input.requestedId ||
    input.latest.publishedAt !== null ||
    input.enrollmentCount > 0
  ) {
    throw new ApiException(409, "COURSE_REVISION_NOT_DRAFT");
  }
  if (input.revisionCount < 2) throw new ApiException(409, "COURSE_REVISION_REQUIRED");
};

export const referenceIncrements = (
  assetIds: ReadonlyArray<string | null>,
): Map<string, number> => {
  const increments = new Map<string, number>();
  for (const assetId of assetIds) {
    if (assetId !== null) increments.set(assetId, (increments.get(assetId) ?? 0) + 1);
  }
  return increments;
};

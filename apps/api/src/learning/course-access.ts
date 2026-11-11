import { NotFoundException } from "@nestjs/common";
import { ApiException } from "../http/api-exception";

export interface EnrollmentAccessRow {
  id: string;
  status: string;
  courseRevisionId: string | null;
  course: { deletedAt: Date | null };
  courseRevision: { id: string; number: number; deletedAt: Date | null } | null;
}

export interface LearnerAccess {
  enrollmentId: string;
  status: "APPROVED" | "COMPLETED";
  revisionId: string;
  revisionNumber: number;
}

export const learnsCourse = (status: string): status is "APPROVED" | "COMPLETED" =>
  status === "APPROVED" || status === "COMPLETED";

export const requireLearnableEnrollment = (row: EnrollmentAccessRow | null): LearnerAccess => {
  if (row === null || !learnsCourse(row.status)) {
    throw new ApiException(403, "ENROLLMENT_NOT_ACTIVE");
  }
  if (
    row.courseRevisionId === null ||
    row.courseRevision === null ||
    row.course.deletedAt !== null ||
    row.courseRevision.deletedAt !== null
  ) {
    throw new NotFoundException();
  }
  return {
    enrollmentId: row.id,
    status: row.status,
    revisionId: row.courseRevision.id,
    revisionNumber: row.courseRevision.number,
  };
};

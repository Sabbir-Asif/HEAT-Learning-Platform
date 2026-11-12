import { enrollmentStatuses } from "@heat/contracts";
import type { CertificateStatus, EnrollmentStatusName } from "@heat/contracts";
import type { SortState } from "@heat/ui/data";

export const studentStatusFilterKey = "status";
export const studentStatusFilterOptions = { [studentStatusFilterKey]: enrollmentStatuses };

export const studentStatusLabels: Record<EnrollmentStatusName, string> = {
  PENDING_VERIFICATION: "Pending verification",
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  REMOVED: "Removed",
};

export const studentBadgeStatus = (status: EnrollmentStatusName): string =>
  status.toLowerCase().replaceAll("_", "-");

export const studentSortable = ["name", "requestedAt"] as const;

export type StudentSortValue = "name" | "-name" | "requestedAt" | "-requestedAt";

export const studentSortValue = (sort: SortState | null): StudentSortValue => {
  if (sort === null) return "name";
  const id = sort.id === "requestedAt" ? "requestedAt" : "name";
  return sort.desc ? `-${id}` : id;
};

export const canRemoveStudent = (status: EnrollmentStatusName): boolean =>
  status === "APPROVED" || status === "COMPLETED";

export const canReinstateStudent = (status: EnrollmentStatusName): boolean => status === "REMOVED";

export const removalNotice = (action: "remove" | "reinstate", name: string): string =>
  action === "remove" ? `${name} was removed from the course.` : `${name} was reinstated.`;

export const moduleStatusLabels = {
  LOCKED: "Locked",
  UNLOCKED: "Unlocked",
  IN_PROGRESS: "In progress",
  QUIZ_READY: "Quiz ready",
  COMPLETED: "Completed",
} as const;

export const decisionActionLabels = {
  APPROVE: "Approved",
  REJECT: "Rejected",
  REMOVE: "Removed",
  REINSTATE: "Reinstated",
} as const;

export const certificateStatusLabels = {
  READY: "Issued",
  PENDING: "Being prepared",
  REVOKED: "Revoked",
} as const;

export const attemptOutcomeLabel = (attempt: {
  submittedAt: string | null;
  passed: boolean;
}): string => {
  if (attempt.submittedAt === null) return "In progress";
  return attempt.passed ? "Passed" : "Failed";
};

export const attemptScoreLabel = (attempt: {
  scorePercent: number | null;
  passMarkSnapshot: number;
}): string =>
  attempt.scorePercent === null
    ? "Not scored"
    : `${attempt.scorePercent}% (pass mark ${attempt.passMarkSnapshot}%)`;

export const videoCoverageLabel = (video: {
  coveragePercent: number;
  meetsThreshold: boolean;
}): string =>
  video.meetsThreshold
    ? `${video.coveragePercent}% watched, counts as complete`
    : `${video.coveragePercent}% watched`;

export const certificateDownloadHref = (id: string): string =>
  `/api/admin/certificates/${encodeURIComponent(id)}/download`;

export const studentProfileHref = (userId: string): string =>
  `/students/${encodeURIComponent(userId)}`;

export type CertificateAction = "revoke" | "reissue";

export const canRevokeCertificate = (status: CertificateStatus): boolean => status === "READY";

export const canReissueCertificate = (status: CertificateStatus): boolean => status === "READY";

export const certificateActionCopy: Record<
  CertificateAction,
  {
    title: string;
    confirm: string;
    destructive: boolean;
    description: (number: string) => string;
  }
> = {
  revoke: {
    title: "Revoke certificate",
    confirm: "Revoke certificate",
    destructive: true,
    description: (number) =>
      `Certificate ${number} stops verifying as valid and the student can no longer download it. This cannot be undone.`,
  },
  reissue: {
    title: "Reissue certificate",
    confirm: "Reissue certificate",
    destructive: false,
    description: (number) =>
      `Certificate ${number} is rendered again with the student's current name. The number stays the same and the student gets a new ready email.`,
  },
};

export const certificateActionNotice = (action: CertificateAction, number: string): string =>
  action === "revoke"
    ? `Certificate ${number} was revoked.`
    : `Certificate ${number} is being reissued. Refresh in a moment to see the new file.`;

import { studentEnrollmentStatuses } from "@heat/contracts";
import type { StudentEnrollmentStatus } from "@heat/contracts";

export const studentStatusLabels: Record<StudentEnrollmentStatus, string> = {
  PENDING_VERIFICATION: "Awaiting email verification",
  PENDING_APPROVAL: "Awaiting approval",
  APPROVED: "Approved",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  REMOVED: "Removed",
};

export const studentStatusOptions = [
  { value: "all", label: "All statuses" },
  ...studentEnrollmentStatuses.map((status) => ({
    value: status,
    label: studentStatusLabels[status],
  })),
];

export const exportButtonLabel = "Export CSV";

export const exportDescription =
  "The file contains personal data and follows the filters below. Each export is recorded in the audit log.";

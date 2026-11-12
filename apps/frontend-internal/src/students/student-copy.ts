import { enrollmentStatuses } from "@heat/contracts";
import type { EnrollmentStatusName } from "@heat/contracts";
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

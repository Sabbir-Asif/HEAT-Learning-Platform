import type { SortState } from "@heat/ui/data";

const failureMessages: Record<string, string> = {
  ENROLLMENT_NOT_VERIFIED: "The student has not verified their email yet.",
  ENROLLMENT_ALREADY_DECIDED: "This request was already decided or the student withdrew it.",
  NOT_FOUND: "This request no longer exists.",
  COURSE_NOT_AVAILABLE: "The course has no published content to enroll the student in.",
};

export const approvalFailureMessage = (code: string): string =>
  failureMessages[code] ?? "Something went wrong. Try this one again.";

export const approvalSummaryText = (succeeded: number, failed: number): string => {
  if (failed === 0) return `${succeeded} approved.`;
  return `${succeeded === 0 ? "None" : succeeded} approved, ${failed} not approved.`;
};

export const selectionLabel = (count: number): string =>
  `${count} ${count === 1 ? "request" : "requests"} selected`;

export const queueSortValue = (sort: SortState | null): "requestedAt" | "-requestedAt" =>
  sort?.id === "requestedAt" && sort.desc ? "-requestedAt" : "requestedAt";

export const approveLabel = (count: number): string =>
  count === 1 ? "Approve 1 request" : `Approve ${count} requests`;

export const rejectLabel = (count: number): string =>
  count === 1 ? "Reject 1 request" : `Reject ${count} requests`;

export const rejectionSummaryText = (succeeded: number, failed: number): string => {
  if (failed === 0) return `${succeeded} rejected.`;
  return `${succeeded === 0 ? "None" : succeeded} rejected, ${failed} not rejected.`;
};

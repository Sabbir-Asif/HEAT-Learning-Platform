import type { AdminProfileChangeListResponseDtoItemsItem } from "@heat/api-client";
import { isApiError } from "@heat/api-client";
import { formErrorCopy } from "@heat/ui";

export type ProfileChangeRow = AdminProfileChangeListResponseDtoItemsItem;

export const profileChangeStatusFilters = ["pending", "approved", "rejected"] as const;

export type ProfileChangeStatusFilter = (typeof profileChangeStatusFilters)[number];

export const statusFilterItems: Array<{ value: ProfileChangeStatusFilter; label: string }> = [
  { value: "pending", label: "Waiting for a decision" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export const toStatusFilter = (value: string): ProfileChangeStatusFilter =>
  profileChangeStatusFilters.find((status) => status === value) ?? "pending";

export const statusParam = (
  filter: ProfileChangeStatusFilter,
): "PENDING" | "APPROVED" | "REJECTED" =>
  filter === "approved" ? "APPROVED" : filter === "rejected" ? "REJECTED" : "PENDING";

export const emptyCopy: Record<ProfileChangeStatusFilter, { title: string; description: string }> =
  {
    pending: {
      title: "No change requests waiting",
      description: "Requests appear here when an approved student asks to change their details.",
    },
    approved: {
      title: "No approved change requests",
      description: "Approved requests are listed here.",
    },
    rejected: {
      title: "No rejected change requests",
      description: "Rejected requests are listed here with the reason.",
    },
  };

export const statusLabel: Record<ProfileChangeRow["status"], string> = {
  PENDING: "Waiting",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const changeLines = (row: ProfileChangeRow): string[] => {
  const lines: string[] = [];
  const { current, requested } = row;
  if (requested.name !== null) lines.push(`Name: ${current.name} to ${requested.name}`);
  if (requested.university !== null) {
    lines.push(`University: ${current.university.name} to ${requested.university.name}`);
  }
  if (requested.faculty !== null) {
    lines.push(`Faculty: ${current.faculty.name} to ${requested.faculty.name}`);
  }
  if (requested.department !== null) {
    lines.push(`Department: ${current.department.name} to ${requested.department.name}`);
  }
  if (requested.session !== null) {
    lines.push(`Session: ${current.session} to ${requested.session}`);
  }
  return lines;
};

export const decisionFailureMessage = (error: unknown): string => {
  if (!isApiError(error)) return formErrorCopy.INTERNAL;
  const departmentField = error.fields.some((field) => field.path === "departmentId");
  if (departmentField) {
    return "The requested department is archived or no longer offered. Reject this request and ask the student to choose another.";
  }
  if (error.fields.some((field) => field.path === "name")) {
    return "The requested name is not in English letters. Reject this request.";
  }
  if (error.code === "VALIDATION_FAILED") return formErrorCopy.VALIDATION_FAILED;
  return formErrorCopy[error.code];
};

export const approveSummary = (name: string): string =>
  `Approving applies these changes to the profile of ${name}. Existing certificates keep the name they were issued with.`;

export const rejectSummary = (name: string): string =>
  `${name} sees your reason on their profile and can send a new request.`;

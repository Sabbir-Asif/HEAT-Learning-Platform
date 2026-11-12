import { ApiException } from "../http/api-exception";
import type { EnrollmentStatusName } from "./approval-rules";

export type RestorableStatus = "APPROVED" | "COMPLETED";

export const removalRefusal = (status: EnrollmentStatusName): ApiException | null =>
  status === "APPROVED" || status === "COMPLETED"
    ? null
    : new ApiException(409, "ENROLLMENT_NOT_REMOVABLE");

export const reinstatementTarget = (
  status: EnrollmentStatusName,
  statusBeforeRemoval: EnrollmentStatusName | null,
): RestorableStatus => {
  if (status !== "REMOVED") throw new ApiException(409, "ENROLLMENT_NOT_REMOVED");
  return statusBeforeRemoval === "COMPLETED" ? "COMPLETED" : "APPROVED";
};

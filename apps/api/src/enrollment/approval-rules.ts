import type { HeatClient } from "@heat/db";
import { ApiException } from "../http/api-exception";

export type EnrollmentStatusName =
  | "PENDING_VERIFICATION"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "COMPLETED"
  | "REJECTED"
  | "EXPIRED"
  | "REMOVED";

export const approvalRefusal = (status: EnrollmentStatusName): ApiException | null => {
  if (status === "PENDING_APPROVAL") return null;
  if (status === "PENDING_VERIFICATION") return new ApiException(409, "ENROLLMENT_NOT_VERIFIED");
  return new ApiException(409, "ENROLLMENT_ALREADY_DECIDED");
};

export const isStudentProfileLocked = async (
  client: Pick<HeatClient, "enrollment">,
  userId: string,
): Promise<boolean> => {
  const approved = await client.enrollment.count({
    where: { userId, approvedAt: { not: null } },
  });
  return approved > 0;
};

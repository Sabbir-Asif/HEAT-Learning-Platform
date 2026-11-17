import type { ProfileChangeRequestDto } from "@heat/api-client";

export type ChangeRequestState = "none" | "pending" | "rejected";

export const changeRequestState = (
  request: Pick<ProfileChangeRequestDto, "status"> | null,
): ChangeRequestState => {
  if (request === null) return "none";
  if (request.status === "PENDING") return "pending";
  if (request.status === "REJECTED") return "rejected";
  return "none";
};

export const requestedLines = (requested: ProfileChangeRequestDto["requested"]): string[] => {
  const lines: string[] = [];
  if (requested.name !== null) lines.push(`Name: ${requested.name}`);
  if (requested.university !== null) lines.push(`University: ${requested.university.name}`);
  if (requested.faculty !== null) lines.push(`Faculty: ${requested.faculty.name}`);
  if (requested.department !== null) lines.push(`Department: ${requested.department.name}`);
  if (requested.session !== null) lines.push(`Session: ${requested.session}`);
  return lines;
};

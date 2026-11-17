import { englishNameSchema } from "@heat/contracts";
import type { SubmitProfileChangeRequest } from "@heat/contracts";
import { ApiException } from "../http/api-exception";

export interface CurrentProfile {
  name: string;
  session: string;
  department: {
    id: string;
    universityFaculty: { universityId: string; facultyId: string };
  };
}

export interface RequestedChanges {
  name?: string;
  departmentId?: string;
  session?: string;
}

export const departmentIsChanging = (
  current: CurrentProfile,
  request: Pick<SubmitProfileChangeRequest, "departmentId">,
): boolean => request.departmentId !== current.department.id;

export const pairIsChanging = (
  current: CurrentProfile,
  request: Pick<SubmitProfileChangeRequest, "universityId" | "facultyId">,
): boolean =>
  request.universityId !== current.department.universityFaculty.universityId ||
  request.facultyId !== current.department.universityFaculty.facultyId;

export const requestedChanges = (
  current: CurrentProfile,
  request: SubmitProfileChangeRequest,
): RequestedChanges => ({
  ...(request.name === current.name ? {} : { name: request.name }),
  ...(departmentIsChanging(current, request) ? { departmentId: request.departmentId } : {}),
  ...(request.session === current.session ? {} : { session: request.session }),
});

export const assertSomethingChanges = (changes: RequestedChanges): void => {
  if (Object.keys(changes).length === 0) throw new ApiException(409, "PROFILE_CHANGE_UNCHANGED");
};

export const assertStoredNameIsEnglish = (name: string): void => {
  if (englishNameSchema.safeParse(name).success) return;
  throw new ApiException(400, "VALIDATION_FAILED", undefined, undefined, [
    { path: "name", code: "invalid_format" },
  ]);
};

export const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";

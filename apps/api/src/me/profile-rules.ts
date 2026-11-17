import { ApiException } from "../http/api-exception";

export const avatarEntity = "StudentProfile";

export const isProfileLocked = (approvalCount: number): boolean => approvalCount > 0;

export const assertProfileEditable = (locked: boolean): void => {
  if (locked) throw new ApiException(403, "PROFILE_LOCKED");
};

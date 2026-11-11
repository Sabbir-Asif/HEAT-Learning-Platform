import { ApiException } from "../http/api-exception";

export interface PlaybackFacts {
  enrollmentStatus: string | null;
  moduleStatus: string | null;
  assetStatus: string | null;
}

const playableEnrollment = ["APPROVED", "COMPLETED"];

export const playbackRefusal = (facts: PlaybackFacts): ApiException | null => {
  if (facts.enrollmentStatus === null || !playableEnrollment.includes(facts.enrollmentStatus)) {
    return new ApiException(403, "ENROLLMENT_NOT_ACTIVE");
  }
  const rewatch = facts.enrollmentStatus === "COMPLETED";
  if (!rewatch && (facts.moduleStatus === null || facts.moduleStatus === "LOCKED")) {
    return new ApiException(403, "MODULE_LOCKED");
  }
  if (facts.assetStatus !== "READY") return new ApiException(409, "VIDEO_NOT_READY");
  return null;
};

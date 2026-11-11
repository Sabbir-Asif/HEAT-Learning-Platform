import type { VideoFailureReason } from "@heat/contracts";
import type { TranscodeOutcome } from "./transcode-job";

export interface QueueFailure {
  reason: VideoFailureReason;
  retry: boolean;
}

export const transcodeFailure = (outcome: TranscodeOutcome): QueueFailure | null => {
  if (outcome.status === "retry") return { reason: outcome.reason, retry: true };
  if (outcome.status === "failed") return { reason: outcome.reason, retry: false };
  return null;
};

export const isFinalAttempt = (attemptsMade: number, attempts: number | undefined): boolean =>
  attemptsMade + 1 >= (attempts ?? 1);

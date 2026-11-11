import type { VerificationEmailStatus } from "@heat/contracts";

export type VerificationJob = {
  status: "QUEUED" | "DELAYED" | "SENDING" | "SENT" | "FAILED";
  sentAt: Date | null;
};

export type VerificationEmailState = {
  status: VerificationEmailStatus | null;
  sentAt: Date | null;
};

export const deriveVerificationEmail = (
  emailVerifiedAt: Date | null,
  latestJob: VerificationJob | null,
): VerificationEmailState => {
  if (emailVerifiedAt !== null) return { status: null, sentAt: null };
  if (latestJob?.status === "SENT") return { status: "SENT", sentAt: latestJob.sentAt };
  if (latestJob?.status === "FAILED") return { status: "FAILED", sentAt: null };
  return { status: "ON_ITS_WAY", sentAt: null };
};

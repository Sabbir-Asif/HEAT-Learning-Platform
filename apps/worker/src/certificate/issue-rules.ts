export interface ExistingCertificate {
  id: string;
  number: string;
  recipientName: string;
  fileKey: string | null;
  fileSha256: string | null;
  fileSizeBytes: number | null;
  revokedAt: Date | null;
}

export interface IssueFacts {
  enrollmentStatus: string;
  emailVerified: boolean;
  holderName: string;
  certificate: ExistingCertificate | null;
}

export type IssueDecision =
  | { action: "issue" }
  | { action: "resume" }
  | { action: "noop"; reason: string }
  | { action: "held"; reason: string }
  | { action: "not-eligible"; reason: string };

export const isCertificateComplete = (certificate: ExistingCertificate): boolean =>
  certificate.fileKey !== null &&
  certificate.fileSha256 !== null &&
  certificate.fileSizeBytes !== null;

export const decideIssue = (facts: IssueFacts): IssueDecision => {
  const { certificate } = facts;
  if (certificate !== null) {
    if (certificate.revokedAt !== null) return { action: "noop", reason: "certificate revoked" };
    if (isCertificateComplete(certificate)) {
      return { action: "noop", reason: "certificate already issued" };
    }
    return { action: "resume" };
  }
  if (facts.enrollmentStatus !== "COMPLETED") {
    return { action: "not-eligible", reason: "enrollment not completed" };
  }
  if (facts.holderName.trim() === "") {
    return { action: "not-eligible", reason: "holder name missing" };
  }
  if (!facts.emailVerified) return { action: "held", reason: "email not verified" };
  return { action: "issue" };
};

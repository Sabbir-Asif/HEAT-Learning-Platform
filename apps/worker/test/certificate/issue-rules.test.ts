import { describe, expect, test } from "vitest";
import { decideIssue, isCertificateComplete } from "../../src/certificate/issue-rules";
import type { ExistingCertificate, IssueFacts } from "../../src/certificate/issue-rules";

const complete: ExistingCertificate = {
  id: "certificate-id",
  number: "ABCD-EFGH-JKMN",
  fileKey: "key.pdf",
  fileSha256: "sha",
  fileSizeBytes: 10,
  revokedAt: null,
};

const facts = (overrides: Partial<IssueFacts> = {}): IssueFacts => ({
  enrollmentStatus: "COMPLETED",
  emailVerified: true,
  holderName: "Amina Rahman",
  certificate: null,
  ...overrides,
});

describe("decideIssue", () => {
  test("issues for a completed enrollment with a verified email", () => {
    expect(decideIssue(facts())).toEqual({ action: "issue" });
  });

  test("holds the certificate while the email is unverified", () => {
    expect(decideIssue(facts({ emailVerified: false }))).toEqual({
      action: "held",
      reason: "email not verified",
    });
  });

  test.each(["APPROVED", "PENDING_APPROVAL", "REMOVED", "REJECTED", "EXPIRED"])(
    "is not eligible when the enrollment is %s and no certificate exists",
    (enrollmentStatus) => {
      expect(decideIssue(facts({ enrollmentStatus }))).toEqual({
        action: "not-eligible",
        reason: "enrollment not completed",
      });
    },
  );

  test("is not eligible without a holder name", () => {
    expect(decideIssue(facts({ holderName: "  " }))).toEqual({
      action: "not-eligible",
      reason: "holder name missing",
    });
  });

  test("does nothing when a complete certificate exists", () => {
    expect(decideIssue(facts({ certificate: complete }))).toEqual({
      action: "noop",
      reason: "certificate already issued",
    });
  });

  test("leaves the certificate of a removed student untouched", () => {
    expect(decideIssue(facts({ enrollmentStatus: "REMOVED", certificate: complete }))).toEqual({
      action: "noop",
      reason: "certificate already issued",
    });
  });

  test("does nothing for a revoked certificate", () => {
    const revoked = { ...complete, revokedAt: new Date() };
    expect(decideIssue(facts({ certificate: revoked }))).toEqual({
      action: "noop",
      reason: "certificate revoked",
    });
  });

  test.each([
    { fileKey: null },
    { fileSha256: null },
    { fileSizeBytes: null },
    { fileKey: null, fileSha256: null, fileSizeBytes: null },
  ])("resumes a certificate whose file is incomplete (%o)", (missing) => {
    expect(decideIssue(facts({ certificate: { ...complete, ...missing } }))).toEqual({
      action: "resume",
    });
  });

  test("resumes even when the enrollment is held or no longer completed", () => {
    const incomplete = { ...complete, fileKey: null };
    expect(
      decideIssue(
        facts({ enrollmentStatus: "REMOVED", emailVerified: false, certificate: incomplete }),
      ),
    ).toEqual({ action: "resume" });
  });
});

describe("isCertificateComplete", () => {
  test("requires key, hash and size", () => {
    expect(isCertificateComplete(complete)).toBe(true);
    expect(isCertificateComplete({ ...complete, fileSizeBytes: null })).toBe(false);
  });
});

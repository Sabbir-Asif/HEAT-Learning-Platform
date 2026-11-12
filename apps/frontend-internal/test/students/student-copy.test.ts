import { enrollmentStatuses } from "@heat/contracts";
import { describe, expect, test } from "vitest";
import {
  attemptGrantDescription,
  attemptGrantNotice,
  attemptLimitLabel,
  attemptOutcomeLabel,
  attemptScoreLabel,
  certificateDownloadHref,
  videoCoverageLabel,
  canReinstateStudent,
  canReissueCertificate,
  canRevokeCertificate,
  certificateActionCopy,
  certificateActionNotice,
  canRemoveStudent,
  removalNotice,
  studentBadgeStatus,
  studentSortValue,
  studentStatusFilterOptions,
  studentStatusLabels,
} from "../../src/students/student-copy";

describe("student copy", () => {
  test("sorts by name ascending unless the table says otherwise", () => {
    expect(studentSortValue(null)).toBe("name");
    expect(studentSortValue({ id: "name", desc: true })).toBe("-name");
    expect(studentSortValue({ id: "requestedAt", desc: false })).toBe("requestedAt");
    expect(studentSortValue({ id: "requestedAt", desc: true })).toBe("-requestedAt");
  });

  test("maps every status to a badge key and a label", () => {
    expect(studentBadgeStatus("PENDING_APPROVAL")).toBe("pending-approval");
    for (const status of enrollmentStatuses) expect(studentStatusLabels[status]).toBeTruthy();
  });

  test("offers every enrollment status as a URL filter value", () => {
    expect(studentStatusFilterOptions.status).toEqual(enrollmentStatuses);
  });
});

describe("removal actions", () => {
  test("offers removal only for approved and completed students", () => {
    const removable = enrollmentStatuses.filter(canRemoveStudent);
    expect(removable).toEqual(["APPROVED", "COMPLETED"]);
  });

  test("offers reinstatement only for removed students", () => {
    expect(enrollmentStatuses.filter(canReinstateStudent)).toEqual(["REMOVED"]);
  });

  test("words the confirmation for each action", () => {
    expect(removalNotice("remove", "Amina")).toBe("Amina was removed from the course.");
    expect(removalNotice("reinstate", "Amina")).toBe("Amina was reinstated.");
  });
});

describe("student detail copy", () => {
  test("labels an attempt by whether it was submitted and passed", () => {
    expect(attemptOutcomeLabel({ submittedAt: null, passed: false })).toBe("In progress");
    expect(attemptOutcomeLabel({ submittedAt: "2026-11-01T00:00:00.000Z", passed: true })).toBe(
      "Passed",
    );
    expect(attemptOutcomeLabel({ submittedAt: "2026-11-01T00:00:00.000Z", passed: false })).toBe(
      "Failed",
    );
  });

  test("shows the score beside the pass mark it was judged against", () => {
    expect(attemptScoreLabel({ scorePercent: 60, passMarkSnapshot: 90 })).toBe(
      "60% (pass mark 90%)",
    );
    expect(attemptScoreLabel({ scorePercent: null, passMarkSnapshot: 90 })).toBe("Not scored");
  });

  test("says when a video counts as complete under the 80 percent rule", () => {
    expect(videoCoverageLabel({ coveragePercent: 85, meetsThreshold: true })).toBe(
      "85% watched, counts as complete",
    );
    expect(videoCoverageLabel({ coveragePercent: 40, meetsThreshold: false })).toBe("40% watched");
  });

  test("downloads certificates through the admin route", () => {
    expect(certificateDownloadHref("abc")).toBe("/api/admin/certificates/abc/download");
  });
});

describe("certificate actions", () => {
  test("only a ready certificate can be revoked or reissued", () => {
    expect(canRevokeCertificate("READY")).toBe(true);
    expect(canReissueCertificate("READY")).toBe(true);
    for (const status of ["PENDING", "REVOKED"] as const) {
      expect(canRevokeCertificate(status)).toBe(false);
      expect(canReissueCertificate(status)).toBe(false);
    }
  });

  test("the confirmation names the certificate number", () => {
    expect(certificateActionCopy.revoke.description("ABCD-EFGH-JKMN")).toContain("ABCD-EFGH-JKMN");
    expect(certificateActionCopy.reissue.description("ABCD-EFGH-JKMN")).toContain("ABCD-EFGH-JKMN");
    expect(certificateActionCopy.revoke.destructive).toBe(true);
  });

  test("the notice says what happened to which certificate", () => {
    expect(certificateActionNotice("revoke", "ABCD")).toBe("Certificate ABCD was revoked.");
    expect(certificateActionNotice("reissue", "ABCD")).toContain("being reissued");
  });
});

describe("attempt grant copy", () => {
  test("names the student and the module", () => {
    expect(attemptGrantDescription("Anne", "Consent")).toContain("Anne gets exactly one more");
    expect(attemptGrantDescription("Anne", "Consent")).toContain("quiz in Consent");
    expect(attemptGrantNotice("Anne", "Consent")).toBe(
      "Anne can submit one more attempt in Consent.",
    );
  });

  test("describes the attempt limit with any granted attempts", () => {
    expect(attemptLimitLabel({ attemptLimit: null, grantedAttempts: 0 })).toBe(
      "Unlimited attempts",
    );
    expect(attemptLimitLabel({ attemptLimit: 3, grantedAttempts: 0 })).toBe("3 attempts allowed");
    expect(attemptLimitLabel({ attemptLimit: 3, grantedAttempts: 2 })).toBe(
      "5 attempts allowed (2 granted by an admin)",
    );
  });
});

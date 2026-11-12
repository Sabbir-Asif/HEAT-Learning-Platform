import { enrollmentStatuses } from "@heat/contracts";
import { describe, expect, test } from "vitest";
import {
  attemptOutcomeLabel,
  attemptScoreLabel,
  certificateDownloadHref,
  videoCoverageLabel,
  canReinstateStudent,
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

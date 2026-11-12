import { enrollmentStatuses } from "@heat/contracts";
import { describe, expect, test } from "vitest";
import {
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

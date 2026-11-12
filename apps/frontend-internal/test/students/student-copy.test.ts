import { enrollmentStatuses } from "@heat/contracts";
import { describe, expect, test } from "vitest";
import {
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

import { describe, expect, test } from "vitest";
import {
  approvalFailureMessage,
  approvalSummaryText,
  approveLabel,
  queueSortValue,
  selectionLabel,
} from "../../src/enrollments/approval-copy";

describe("approvalFailureMessage", () => {
  test("explains each stable code a bulk approval can fail with", () => {
    expect(approvalFailureMessage("ENROLLMENT_NOT_VERIFIED")).toContain("verified");
    expect(approvalFailureMessage("ENROLLMENT_ALREADY_DECIDED")).toContain("already decided");
    expect(approvalFailureMessage("NOT_FOUND")).toContain("no longer");
    expect(approvalFailureMessage("COURSE_NOT_AVAILABLE")).toContain("course");
  });

  test("falls back to a generic line for any other code", () => {
    expect(approvalFailureMessage("INTERNAL")).toBe("Something went wrong. Try this one again.");
  });
});

describe("approvalSummaryText", () => {
  test("counts approved and not approved requests", () => {
    expect(approvalSummaryText(49, 1)).toBe("49 approved, 1 not approved.");
    expect(approvalSummaryText(1, 0)).toBe("1 approved.");
    expect(approvalSummaryText(0, 2)).toBe("None approved, 2 not approved.");
  });
});

describe("selectionLabel", () => {
  test("names the selected count", () => {
    expect(selectionLabel(1)).toBe("1 request selected");
    expect(selectionLabel(3)).toBe("3 requests selected");
  });
});

describe("queueSortValue", () => {
  test("defaults to oldest first and flips for a descending sort", () => {
    expect(queueSortValue(null)).toBe("requestedAt");
    expect(queueSortValue({ id: "requestedAt", desc: false })).toBe("requestedAt");
    expect(queueSortValue({ id: "requestedAt", desc: true })).toBe("-requestedAt");
  });
});

describe("approveLabel", () => {
  test("names how many requests the button approves", () => {
    expect(approveLabel(1)).toBe("Approve 1 request");
    expect(approveLabel(4)).toBe("Approve 4 requests");
  });
});

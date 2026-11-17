import { describe, expect, test } from "vitest";
import {
  asOfLabel,
  formatAge,
  oldestPendingValue,
  passRateDescription,
  passRateRows,
  pendingQueueHref,
  showCourseSelector,
  statusRows,
  withheldNote,
} from "../../src/overview/overview-model";

const overview = (overrides: Record<string, unknown> = {}) => ({
  statusCounts: [
    { status: "PENDING_VERIFICATION" as const, count: 1 },
    { status: "PENDING_APPROVAL" as const, count: 3 },
    { status: "APPROVED" as const, count: 12 },
  ],
  totalEnrollments: 16,
  pending: { count: 3, oldestRequestedAt: "2026-11-15T06:00:00.000Z", oldestAgeSeconds: 172800 },
  certificatesIssued: 4,
  passRates: [
    { moduleId: "m1", label: "Module 1", suppressed: false, students: 20, passRate: 85.5 },
    { moduleId: "m2", label: "Module 2", suppressed: true, students: null, passRate: null },
  ],
  suppressionThreshold: 5,
  refreshedAt: "2026-11-16T20:30:00.000Z",
  ...overrides,
});

describe("pendingQueueHref", () => {
  test("opens the queue sorted oldest first", () => {
    expect(pendingQueueHref("")).toBe("/enrollments?sort=requestedAt");
  });

  test("keeps the chosen course", () => {
    expect(pendingQueueHref("c-1")).toBe("/enrollments?sort=requestedAt&course=c-1");
  });
});

describe("showCourseSelector", () => {
  test("shows only when more than one course exists", () => {
    expect(showCourseSelector(0)).toBe(false);
    expect(showCourseSelector(1)).toBe(false);
    expect(showCourseSelector(2)).toBe(true);
  });
});

describe("age of the oldest pending request", () => {
  test("uses days, hours and minutes", () => {
    expect(formatAge(172800)).toBe("2 days");
    expect(formatAge(86400)).toBe("1 day");
    expect(formatAge(7200)).toBe("2 hours");
    expect(formatAge(1200)).toBe("20 minutes");
    expect(formatAge(5)).toBe("1 minute");
  });

  test("says so when nothing is waiting", () => {
    expect(oldestPendingValue({ count: 0, oldestRequestedAt: null, oldestAgeSeconds: null })).toBe(
      "None waiting",
    );
    expect(oldestPendingValue(overview().pending)).toBe("2 days");
  });
});

describe("asOfLabel", () => {
  test("shows the last refresh in Asia/Dhaka time", () => {
    expect(asOfLabel("2026-11-16T20:30:00.000Z")).toBe(
      "Pass rates as of 17 Nov 2026, 02:30 (Asia/Dhaka).",
    );
  });

  test("explains when no refresh has finished", () => {
    expect(asOfLabel(null)).toContain("not available yet");
  });
});

describe("pass rates", () => {
  test("charts only modules with enough students and explains the withheld ones", () => {
    expect(passRateRows(overview())).toEqual([{ module: "Module 1", passRate: 85.5 }]);
    expect(withheldNote(overview())).toBe(
      "Not shown because fewer than 5 students took the quiz: Module 2.",
    );
    expect(passRateDescription(overview())).toContain("Module 2");
  });

  test("has no note when every module is shown", () => {
    const shown = overview({ passRates: [overview().passRates[0]] });
    expect(withheldNote(shown)).toBeNull();
  });
});

describe("statusRows", () => {
  test("labels each status", () => {
    expect(statusRows(overview())).toEqual([
      { status: "Awaiting email check", count: 1 },
      { status: "Awaiting approval", count: 3 },
      { status: "Approved", count: 12 },
    ]);
  });

  test("is empty when there are no enrollments", () => {
    expect(statusRows(overview({ totalEnrollments: 0 }))).toEqual([]);
  });
});

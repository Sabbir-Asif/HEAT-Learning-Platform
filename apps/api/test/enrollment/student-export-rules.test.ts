import { describe, expect, test } from "vitest";
import {
  formatDhakaDateTime,
  progressSummary,
  studentExportColumns,
} from "../../src/enrollment/student-export-rules";

describe("formatDhakaDateTime", () => {
  test("shifts to Asia/Dhaka", () => {
    expect(formatDhakaDateTime(new Date("2026-11-11T20:30:00Z"))).toBe("2026-11-12 02:30");
  });

  test("is empty without a date", () => {
    expect(formatDhakaDateTime(null)).toBe("");
  });
});

describe("export columns", () => {
  test("has the agreed twelve columns", () => {
    expect(studentExportColumns).toHaveLength(12);
    expect(progressSummary(2, 5)).toBe("2 of 5 modules");
  });
});

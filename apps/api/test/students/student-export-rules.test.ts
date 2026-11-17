import { describe, expect, test } from "vitest";
import {
  formatDhakaDateTime,
  progressSummary,
  studentExportColumns,
  studentListWhere,
} from "../../src/students/student-export-rules";

describe("studentListWhere", () => {
  test("limits to live enrollments of live students with a live profile", () => {
    expect(studentListWhere({})).toEqual({
      deletedAt: null,
      user: { deletedAt: null, profile: { is: { deletedAt: null } } },
    });
  });

  test("maps every filter", () => {
    const where = studentListWhere({
      courseId: "c",
      universityId: "u",
      facultyId: "f",
      departmentId: "d",
      session: "2020-21",
      status: "APPROVED",
      q: "rahim",
    });
    expect(where).toMatchObject({
      courseId: "c",
      status: "APPROVED",
      user: {
        profile: {
          is: {
            departmentId: "d",
            session: "2020-21",
            department: { universityId: "u", facultyId: "f" },
          },
        },
      },
    });
    expect(where.OR).toHaveLength(2);
  });
});

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

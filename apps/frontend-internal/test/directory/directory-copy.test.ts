import { describe, expect, test } from "vitest";
import { deleteBlockedMessage, usagePhrase } from "../../src/directory/directory-copy";

const usage = (studentCount: number, departmentCount: number, facultyCount: number) => ({
  studentCount,
  departmentCount,
  facultyCount,
});

describe("usagePhrase", () => {
  test.each([
    [usage(0, 0, 0), ""],
    [usage(1, 0, 0), "1 student"],
    [usage(0, 2, 0), "2 departments"],
    [usage(0, 0, 1), "1 faculty link"],
    [usage(3, 0, 2), "3 students and 2 faculty links"],
    [usage(1, 2, 3), "1 student, 2 departments and 3 faculty links"],
  ])("%j reads %j", (input, expected) => {
    expect(usagePhrase(input)).toBe(expected);
  });
});

describe("deleteBlockedMessage", () => {
  test("names the references and suggests archiving", () => {
    expect(deleteBlockedMessage("University of Dhaka", usage(3, 0, 0))).toBe(
      "University of Dhaka is used by 3 students, so it cannot be deleted. Archive it instead.",
    );
  });

  test("falls back when the counts have all dropped to zero", () => {
    expect(deleteBlockedMessage("University of Dhaka", usage(0, 0, 0))).toBe(
      "University of Dhaka is still in use, so it cannot be deleted. Archive it instead.",
    );
  });
});

import { describe, expect, test } from "vitest";
import {
  facultyDeleteBlockedMessage,
  facultyUsagePhrase,
  linkProblemMessage,
  deleteBlockedMessage,
  usagePhrase,
} from "../../src/directory/directory-copy";

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

const facultyUsage = (studentCount: number, departmentCount: number, universityCount: number) => ({
  studentCount,
  departmentCount,
  universityCount,
});

describe("facultyUsagePhrase", () => {
  test.each([
    [facultyUsage(0, 0, 0), ""],
    [facultyUsage(1, 0, 0), "1 student"],
    [facultyUsage(0, 0, 1), "1 university link"],
    [facultyUsage(1, 2, 3), "1 student, 2 departments and 3 university links"],
  ])("%j reads %j", (input, expected) => {
    expect(facultyUsagePhrase(input)).toBe(expected);
  });
});

describe("facultyDeleteBlockedMessage", () => {
  test("names the references and suggests archiving", () => {
    expect(facultyDeleteBlockedMessage("Faculty of Arts", facultyUsage(0, 0, 2))).toBe(
      "Faculty of Arts is used by 2 university links, so it cannot be deleted. Archive it instead.",
    );
  });

  test("falls back when the counts have all dropped to zero", () => {
    expect(facultyDeleteBlockedMessage("Faculty of Arts", facultyUsage(0, 0, 0))).toBe(
      "Faculty of Arts is still in use, so it cannot be deleted. Archive it instead.",
    );
  });
});

describe("linkProblemMessage", () => {
  test("says the faculty was saved and names what could not change", () => {
    expect(
      linkProblemMessage("Faculty of Arts", {
        blocked: ["University of Dhaka"],
        failed: ["BUET", "Jahangirnagar University"],
      }),
    ).toBe(
      "Faculty of Arts was saved. It still has departments at University of Dhaka, so it was not removed from there. Its link with BUET and Jahangirnagar University could not be saved. Try again.",
    );
  });

  test("reports only the part that went wrong", () => {
    expect(linkProblemMessage("Arts", { blocked: [], failed: ["BUET"] })).toBe(
      "Arts was saved. Its link with BUET could not be saved. Try again.",
    );
    expect(linkProblemMessage("Arts", { blocked: ["BUET"], failed: [] })).toBe(
      "Arts was saved. It still has departments at BUET, so it was not removed from there.",
    );
  });
});

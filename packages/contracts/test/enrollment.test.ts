import { describe, expect, test } from "vitest";
import {
  academicSessionMessage,
  academicSessionSchema,
  englishNameMessage,
  englishNameSchema,
  enrollmentStepOneSchema,
} from "../src/index";

const ids = {
  universityId: "7b1c1d2e-3f4a-4b5c-8d6e-9f0a1b2c3d4e",
  facultyId: "8c2d2e3f-4a5b-4c6d-9e7f-0a1b2c3d4e5f",
  departmentId: "9d3e3f4a-5b6c-4d7e-8f80-1b2c3d4e5f60",
};

describe("academicSessionSchema messages", () => {
  test.each(["2020-23", "2020-2021", "20-21", "2020-20", "2020-22", ""])(
    "fails %j with the shared message",
    (value) => {
      const result = academicSessionSchema.safeParse(value);
      expect(result.success).toBe(false);
      expect(result.error?.issues.map((issue) => issue.message)).toEqual([academicSessionMessage]);
    },
  );
});

describe("englishNameSchema", () => {
  test.each([
    ["Md. Sabbir Hosen", "Md. Sabbir Hosen"],
    ["  Anne   O'Neil-Smith  ", "Anne O'Neil-Smith"],
    ["Al", "Al"],
  ])("accepts %j as %j", (input, output) => {
    expect(englishNameSchema.parse(input)).toBe(output);
  });

  test.each([
    "",
    "   ",
    "A",
    "a".repeat(101),
    "সাব্বির হোসেন",
    "José",
    "Name1",
    "Name_x",
    "Name@x",
  ])("rejects %j with the shared message", (value) => {
    const result = englishNameSchema.safeParse(value);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([englishNameMessage]);
  });

  test("accepts exactly 100 characters", () => {
    expect(englishNameSchema.safeParse("a".repeat(100)).success).toBe(true);
  });

  test("rejects a value that is not a string with the shared message", () => {
    const result = englishNameSchema.safeParse(undefined);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([englishNameMessage]);
  });
});

describe("enrollmentStepOneSchema", () => {
  const valid = { name: "Anne Smith", ...ids, session: "2020-21" };

  test("accepts a complete step", () => {
    expect(enrollmentStepOneSchema.parse(valid)).toEqual(valid);
  });

  test.each(["universityId", "facultyId", "departmentId"] as const)("rejects a bad %s", (key) => {
    expect(enrollmentStepOneSchema.safeParse({ ...valid, [key]: "nope" }).success).toBe(false);
  });

  test("rejects a bad session", () => {
    expect(enrollmentStepOneSchema.safeParse({ ...valid, session: "2020-23" }).success).toBe(false);
  });
});

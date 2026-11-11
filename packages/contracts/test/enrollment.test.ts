import { describe, expect, test } from "vitest";
import {
  academicSessionMessage,
  academicSessionSchema,
  englishNameMessage,
  englishNameSchema,
  enrollmentRequestSchema,
  enrollmentStepOneSchema,
  enrollmentStepTwoSchema,
  passwordConfirmationRequiredMessage,
  passwordMismatchMessage,
  departmentRequiredMessage,
  facultyRequiredMessage,
  universityRequiredMessage,
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

  test.each([
    ["universityId", universityRequiredMessage],
    ["facultyId", facultyRequiredMessage],
    ["departmentId", departmentRequiredMessage],
  ] as const)("asks to select when %s is empty", (key, message) => {
    const result = enrollmentStepOneSchema.safeParse({ ...valid, [key]: "" });
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([message]);
  });
});

describe("enrollmentStepTwoSchema", () => {
  const valid = {
    email: "Anne@Example.com ",
    password: "correct horse battery",
    confirmPassword: "correct horse battery",
    captchaId: "1b4e28ba-2fa1-41d2-883f-0016d3cca427",
    captchaAnswer: " AB12 ",
  };

  test("accepts a complete step and normalises email and answer", () => {
    expect(enrollmentStepTwoSchema.parse(valid)).toEqual({
      ...valid,
      email: "anne@example.com",
      captchaAnswer: "AB12",
    });
  });

  test("puts the mismatch message on the confirmation", () => {
    const result = enrollmentStepTwoSchema.safeParse({
      ...valid,
      confirmPassword: "different one 1",
    });
    expect(result.error?.issues.map((issue) => [issue.path, issue.message])).toEqual([
      [["confirmPassword"], passwordMismatchMessage],
    ]);
  });

  test("asks to retype an empty confirmation", () => {
    const result = enrollmentStepTwoSchema.safeParse({ ...valid, confirmPassword: "" });
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      passwordConfirmationRequiredMessage,
    );
  });

  test.each(["short", "a".repeat(257)])("rejects password %#", (password) => {
    const result = enrollmentStepTwoSchema.safeParse({
      ...valid,
      password,
      confirmPassword: password,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["password"]);
  });

  test("keeps password whitespace as typed", () => {
    const password = "  spaces around me  ";
    const parsed = enrollmentStepTwoSchema.parse({
      ...valid,
      password,
      confirmPassword: password,
    });
    expect(parsed.password).toBe(password);
  });

  test.each(["", "nope", "a@b", `${"a".repeat(250)}@example.com`])("rejects email %j", (email) => {
    const result = enrollmentStepTwoSchema.safeParse({ ...valid, email });
    expect(result.error?.issues[0]?.path).toEqual(["email"]);
  });

  test.each([
    ["captchaId", "nope"],
    ["captchaAnswer", "   "],
    ["captchaAnswer", "a".repeat(13)],
  ] as const)("rejects %s %j", (key, value) => {
    const result = enrollmentStepTwoSchema.safeParse({ ...valid, [key]: value });
    expect(result.error?.issues[0]?.path).toEqual([key]);
  });
});

describe("enrollmentRequestSchema", () => {
  const valid = {
    name: "Anne Smith",
    ...ids,
    session: "2020-21",
    email: "anne@example.com",
    password: "correct horse battery",
    confirmPassword: "correct horse battery",
    captchaId: "1b4e28ba-2fa1-41d2-883f-0016d3cca427",
    captchaAnswer: "AB12",
  };

  test("accepts the full payload", () => {
    expect(enrollmentRequestSchema.parse(valid)).toEqual(valid);
  });

  test("applies the step-one rules to a direct call", () => {
    const result = enrollmentRequestSchema.safeParse({
      ...valid,
      name: "সাব্বির",
      session: "2020-23",
      departmentId: "nope",
    });
    expect(result.error?.issues.map((issue) => issue.path[0]).sort()).toEqual([
      "departmentId",
      "name",
      "session",
    ]);
  });

  test("applies the step-two rules to a direct call", () => {
    const result = enrollmentRequestSchema.safeParse({ ...valid, confirmPassword: "other" });
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([["confirmPassword"]]);
  });

  test("rejects a missing step", () => {
    expect(enrollmentRequestSchema.safeParse({ ...valid, name: undefined }).success).toBe(false);
  });
});

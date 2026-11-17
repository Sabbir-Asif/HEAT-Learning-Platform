import { describe, expect, test } from "vitest";
import { changeStudentPasswordRequestSchema, passwordCodeLength } from "../src/index";

const valid = {
  currentPassword: "old password 1",
  code: "123456",
  newPassword: "a brand new passphrase",
};

describe("changeStudentPasswordRequestSchema", () => {
  test("accepts the current password, a six digit code and a new password", () => {
    expect(changeStudentPasswordRequestSchema.safeParse(valid).success).toBe(true);
    expect(passwordCodeLength).toBe(6);
  });

  test("rejects a code that is not exactly six digits", () => {
    for (const code of ["12345", "1234567", "12345a", "", "12 456"]) {
      expect(changeStudentPasswordRequestSchema.safeParse({ ...valid, code }).success).toBe(false);
    }
  });

  test("trims the code before checking it", () => {
    expect(changeStudentPasswordRequestSchema.parse({ ...valid, code: " 123456 " }).code).toBe(
      "123456",
    );
  });

  test("rejects a short new password and a new password equal to the current one", () => {
    expect(
      changeStudentPasswordRequestSchema.safeParse({ ...valid, newPassword: "short" }).success,
    ).toBe(false);
    expect(
      changeStudentPasswordRequestSchema.safeParse({
        ...valid,
        currentPassword: valid.newPassword,
      }).success,
    ).toBe(false);
  });
});

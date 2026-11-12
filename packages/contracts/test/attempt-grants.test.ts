import { describe, expect, test } from "vitest";
import {
  approvalReasonMaxLength,
  attemptGrantParamsSchema,
  errorCodes,
  grantAttemptRequestSchema,
} from "../src/index";

describe("grantAttemptRequestSchema", () => {
  test("treats a missing or blank reason as none", () => {
    expect(grantAttemptRequestSchema.parse({})).toEqual({});
    expect(grantAttemptRequestSchema.parse({ reason: "  " })).toEqual({ reason: undefined });
  });

  test("trims the reason and caps its length", () => {
    expect(grantAttemptRequestSchema.parse({ reason: "  Power cut  " })).toEqual({
      reason: "Power cut",
    });
    const tooLong = "a".repeat(approvalReasonMaxLength + 1);
    expect(grantAttemptRequestSchema.safeParse({ reason: tooLong }).success).toBe(false);
  });
});

describe("attemptGrantParamsSchema", () => {
  test("needs an enrollment id and a quiz id", () => {
    const id = "0195c0de-0000-7000-8000-000000000001";
    expect(attemptGrantParamsSchema.safeParse({ id, quizId: id }).success).toBe(true);
    expect(attemptGrantParamsSchema.safeParse({ id, quizId: "x" }).success).toBe(false);
  });
});

describe("attempt grant error codes", () => {
  test("are published", () => {
    expect(errorCodes).toContain("QUIZ_ATTEMPTS_UNLIMITED");
    expect(errorCodes).toContain("QUIZ_GRANT_NOT_NEEDED");
  });
});

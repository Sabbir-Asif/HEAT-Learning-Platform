import { describe, expect, test } from "vitest";
import {
  approvalReasonMaxLength,
  errorCodes,
  reinstateEnrollmentRequestSchema,
  removeEnrollmentRequestSchema,
} from "../src/index";

describe("removeEnrollmentRequestSchema", () => {
  test("requires a reason", () => {
    expect(removeEnrollmentRequestSchema.safeParse({}).success).toBe(false);
    expect(removeEnrollmentRequestSchema.safeParse({ reason: "   " }).success).toBe(false);
  });

  test("trims the reason and caps its length", () => {
    expect(removeEnrollmentRequestSchema.parse({ reason: "  Left the university  " })).toEqual({
      reason: "Left the university",
    });
    const tooLong = "a".repeat(approvalReasonMaxLength + 1);
    expect(removeEnrollmentRequestSchema.safeParse({ reason: tooLong }).success).toBe(false);
  });
});

describe("reinstateEnrollmentRequestSchema", () => {
  test("treats a missing or blank reason as none", () => {
    expect(reinstateEnrollmentRequestSchema.parse({})).toEqual({});
    expect(reinstateEnrollmentRequestSchema.parse({ reason: "  " })).toEqual({
      reason: undefined,
    });
  });

  test("keeps a given reason", () => {
    expect(reinstateEnrollmentRequestSchema.parse({ reason: " Appeal accepted " })).toEqual({
      reason: "Appeal accepted",
    });
  });
});

describe("removal error codes", () => {
  test("are published", () => {
    expect(errorCodes).toEqual(
      expect.arrayContaining([
        "ENROLLMENT_NOT_REMOVABLE",
        "ENROLLMENT_NOT_REMOVED",
        "ENROLLMENT_STATE_CHANGED",
      ]),
    );
  });
});

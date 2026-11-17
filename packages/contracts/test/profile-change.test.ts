import { describe, expect, test } from "vitest";
import {
  englishNameMessage,
  errorCodes,
  profileChangeNoteMaxLength,
  profileChangeQuerySchema,
  profileChangeReasonRequiredMessage,
  rejectProfileChangeRequestSchema,
  submitProfileChangeRequestSchema,
} from "../src/index";

const ids = {
  universityId: "7b1c1d2e-3f4a-4b5c-8d6e-9f0a1b2c3d4e",
  facultyId: "8c2d2e3f-4a5b-4c6d-9e7f-0a1b2c3d4e5f",
  departmentId: "9d3e3f4a-5b6c-4d7e-8f80-1b2c3d4e5f60",
};

const valid = { name: "Anne Jones", ...ids, session: "2021-22" };

describe("submitProfileChangeRequestSchema", () => {
  test("accepts the enrollment details with an optional note", () => {
    const parsed = submitProfileChangeRequestSchema.parse({ ...valid, note: "  Married name  " });
    expect(parsed.note).toBe("Married name");
  });

  test("treats a blank note as no note", () => {
    expect(submitProfileChangeRequestSchema.parse({ ...valid, note: "   " }).note).toBeUndefined();
  });

  test("rejects a non-Latin name with the enrollment message", () => {
    const result = submitProfileChangeRequestSchema.safeParse({ ...valid, name: "আমিনা" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([englishNameMessage]);
  });

  test("rejects a note over the limit", () => {
    const result = submitProfileChangeRequestSchema.safeParse({
      ...valid,
      note: "a".repeat(profileChangeNoteMaxLength + 1),
    });
    expect(result.success).toBe(false);
  });
});

describe("rejectProfileChangeRequestSchema", () => {
  test("requires a reason", () => {
    const result = rejectProfileChangeRequestSchema.safeParse({ reason: "  " });
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      profileChangeReasonRequiredMessage,
    ]);
  });

  test("trims the reason", () => {
    expect(rejectProfileChangeRequestSchema.parse({ reason: " Not matching records " })).toEqual({
      reason: "Not matching records",
    });
  });
});

describe("profileChangeQuerySchema", () => {
  test("defaults to pending requests on page one", () => {
    expect(profileChangeQuerySchema.parse({})).toEqual({
      status: "PENDING",
      page: 1,
      pageSize: 25,
    });
  });
});

describe("profile change error codes", () => {
  test("are published", () => {
    expect(errorCodes).toEqual(
      expect.arrayContaining([
        "PROFILE_CHANGE_NOT_PENDING",
        "PROFILE_CHANGE_PENDING",
        "PROFILE_CHANGE_UNCHANGED",
      ]),
    );
  });
});

import { describe, expect, test } from "vitest";
import { isNotFoundFailure, toVerificationModel } from "../../src/verify/verification-view";

const verification = {
  status: "VALID" as const,
  holderName: "Rahim Uddin",
  courseTitle: "HEAT Gender Safety",
  completedAt: "2026-11-10T20:00:00.000Z",
};

describe("verification view model", () => {
  test("a valid certificate shows name, course and the Dhaka completion date only", () => {
    const model = toVerificationModel(verification, "ABCD-EFGH-JKMN");

    expect(model.valid).toBe(true);
    expect(model.heading).toBe("This certificate is valid");
    expect(model.rows).toEqual([
      { label: "Name", value: "Rahim Uddin" },
      { label: "Course", value: "HEAT Gender Safety" },
      { label: "Completed", value: "11 November 2026" },
    ]);
  });

  test("a revoked certificate is never presented as valid", () => {
    const model = toVerificationModel({ ...verification, status: "REVOKED" }, "ABCD-EFGH-JKMN");

    expect(model.valid).toBe(false);
    expect(model.heading).toBe("This certificate was revoked");
    expect(model.note).toContain("no longer valid");
  });

  test("only a NOT_FOUND failure counts as not found", () => {
    expect(isNotFoundFailure({ code: "NOT_FOUND" })).toBe(true);
    expect(isNotFoundFailure({ code: "RATE_LIMITED" })).toBe(false);
    expect(isNotFoundFailure(new Error("x"))).toBe(false);
    expect(isNotFoundFailure(null)).toBe(false);
  });
});

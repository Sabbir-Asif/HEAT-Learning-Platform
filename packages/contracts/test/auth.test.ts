import { describe, expect, test } from "vitest";
import {
  grantsCourseAccess,
  landingPathFor,
  meResponseSchema,
  signInRequestSchema,
} from "../src/index";

describe("signInRequestSchema", () => {
  test("trims and lower-cases the email", () => {
    const parsed = signInRequestSchema.parse({ email: "  Student@Example.TEST ", password: "x" });

    expect(parsed.email).toBe("student@example.test");
  });

  test("rejects a malformed email and an empty password with readable messages", () => {
    const result = signInRequestSchema.safeParse({ email: "nope", password: "" });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      "Enter a valid email address.",
      "Enter your password.",
    ]);
  });

  test("rejects an oversized password", () => {
    expect(
      signInRequestSchema.safeParse({ email: "a@b.test", password: "x".repeat(257) }).success,
    ).toBe(false);
  });
});

describe("course access", () => {
  test("only approved and completed enrollments grant access", () => {
    expect(grantsCourseAccess("APPROVED")).toBe(true);
    expect(grantsCourseAccess("COMPLETED")).toBe(true);
    expect(grantsCourseAccess("PENDING_APPROVAL")).toBe(false);
    expect(grantsCourseAccess("REMOVED")).toBe(false);
  });

  test("lands on the dashboard when a course is open, otherwise on awaiting approval", () => {
    expect(landingPathFor([{ status: "PENDING_APPROVAL" }, { status: "COMPLETED" }])).toBe(
      "/dashboard",
    );
    expect(landingPathFor([{ status: "PENDING_APPROVAL" }])).toBe("/awaiting-approval");
    expect(landingPathFor([])).toBe("/awaiting-approval");
  });
});

describe("meResponseSchema", () => {
  test("accepts the documented shape", () => {
    const parsed = meResponseSchema.safeParse({
      user: {
        id: "0190b3a2-7c1e-7a55-9a3b-1f2e3d4c5b6a",
        email: "a@b.test",
                role: "STUDENT",
        emailVerified: true,
        mustChangePassword: false,
      },
      enrollments: [],
    });

    expect(parsed.success).toBe(true);
  });
});

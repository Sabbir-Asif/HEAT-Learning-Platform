import { describe, expect, test } from "vitest";
import {
  adminCsrf,
  adminSessionCookies,
  changePasswordRequestSchema,
  grantsCourseAccess,
  landingPathFor,
  meResponseSchema,
  signInRequestSchema,
  studentCsrf,
  studentSessionCookies,
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

describe("student session cookies", () => {
  test("the refresh cookie is scoped to its endpoint and the access cookie is host-only", () => {
    expect(studentSessionCookies.access.startsWith("__Host-")).toBe(true);
    expect(studentSessionCookies.refresh.startsWith("__Secure-")).toBe(true);
    expect(studentSessionCookies.refreshPath).toBe("/api/auth/refresh");
  });
});

describe("admin session cookies", () => {
  test("the refresh cookie is scoped to the admin endpoint and the access cookie is host-only", () => {
    expect(adminSessionCookies.access.startsWith("__Host-")).toBe(true);
    expect(adminSessionCookies.refresh.startsWith("__Secure-")).toBe(true);
    expect(adminSessionCookies.refreshPath).toBe("/api/admin/auth/refresh");
  });
});

describe("changePasswordRequestSchema", () => {
  const valid = { currentPassword: "old password value", newPassword: "a brand new passphrase" };

  test("accepts a new password of at least twelve characters", () => {
    expect(changePasswordRequestSchema.safeParse(valid).success).toBe(true);
    expect(
      changePasswordRequestSchema.safeParse({ ...valid, newPassword: "twelve chars" }).success,
    ).toBe(true);
  });

  test("refuses a short new password and an empty current password", () => {
    expect(changePasswordRequestSchema.safeParse({ ...valid, newPassword: "short" }).success).toBe(
      false,
    );
    expect(changePasswordRequestSchema.safeParse({ ...valid, currentPassword: "" }).success).toBe(
      false,
    );
  });

  test("refuses a new password equal to the current one", () => {
    const parsed = changePasswordRequestSchema.safeParse({
      currentPassword: "same passphrase 1",
      newPassword: "same passphrase 1",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(["newPassword"]);
  });
});

describe("csrf contract", () => {
  test("each realm has a distinct __Host- cookie and its own token path", () => {
    expect(studentCsrf.cookie).toMatch(/^__Host-/);
    expect(adminCsrf.cookie).toMatch(/^__Host-/);
    expect(studentCsrf.cookie).not.toBe(adminCsrf.cookie);
    expect(studentCsrf.tokenPath).toBe("/api/auth/csrf");
    expect(adminCsrf.tokenPath).toBe("/api/admin/auth/csrf");
  });
});

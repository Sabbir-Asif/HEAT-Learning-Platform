import { describe, expect, test } from "vitest";
import { safeNextPath } from "../../src/auth/next-path";
import { signInLocation } from "../../src/auth/sign-in-location";

describe("safeNextPath", () => {
  test.each([
    ["/students", "/students"],
    ["/courses/abc?tab=notes#top", "/courses/abc?tab=notes#top"],
    ["/account", "/account"],
  ])("keeps the same-site path %s", (raw, expected) => {
    expect(safeNextPath(raw)).toBe(expected);
  });

  test.each([
    "https://evil.example/students",
    "//evil.example/students",
    "/\\evil.example",
    "\\\\evil.example",
    "/\t/evil.example",
    "javascript:alert(1)",
    "students",
    "",
    "/\u0000x",
    "/auth/refresh?next=/students",
    "/sign-in",
    "/sign-in/anything",
  ])("falls back to the overview for %j", (raw) => {
    expect(safeNextPath(raw)).toBe("/");
  });

  test("falls back for missing input and honours a custom fallback", () => {
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath(null, "/account")).toBe("/account");
  });

  test("never returns a value that leaves the origin", () => {
    for (const raw of ["/@evil.example", "/.evil.example", "/ /evil", "/ //evil.example"]) {
      const result = safeNextPath(raw);
      expect(new URL(result, "https://admin.example").origin).toBe("https://admin.example");
    }
  });
});

describe("signInLocation", () => {
  test("carries a safe next path", () => {
    expect(signInLocation("/students?page=2")).toBe("/sign-in?next=%2Fstudents%3Fpage%3D2");
  });

  test("drops an unsafe next path and the overview", () => {
    expect(signInLocation("https://evil.example")).toBe("/sign-in");
    expect(signInLocation("/")).toBe("/sign-in?next=%2F");
  });
});

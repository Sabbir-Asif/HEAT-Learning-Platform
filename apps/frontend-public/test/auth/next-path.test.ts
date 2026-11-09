import { describe, expect, test } from "vitest";
import { safeNextPath } from "../../src/auth/next-path";
import { signInLocation } from "../../src/auth/sign-in-location";

describe("safeNextPath", () => {
  test.each([
    ["/dashboard", "/dashboard"],
    ["/learn/course-a/module-1?tab=notes#top", "/learn/course-a/module-1?tab=notes#top"],
    ["/profile", "/profile"],
  ])("keeps the same-site path %s", (raw, expected) => {
    expect(safeNextPath(raw)).toBe(expected);
  });

  test.each([
    "https://evil.example/dashboard",
    "//evil.example/dashboard",
    "/\\evil.example",
    "\\\\evil.example",
    "/\t/evil.example",
    "javascript:alert(1)",
    "dashboard",
    "",
    "/\u0000x",
    "/auth/refresh?next=/dashboard",
    "/sign-in",
    "/sign-in/anything",
  ])("falls back for %j", (raw) => {
    expect(safeNextPath(raw)).toBe("/dashboard");
  });

  test("falls back for missing input and honours a custom fallback", () => {
    expect(safeNextPath(undefined)).toBe("/dashboard");
    expect(safeNextPath(null, "/awaiting-approval")).toBe("/awaiting-approval");
  });

  test("never returns a value that leaves the origin", () => {
    for (const raw of ["/@evil.example", "/.evil.example", "/ /evil", "/ //evil.example"]) {
      const result = safeNextPath(raw);
      expect(new URL(result, "https://learn.example").origin).toBe("https://learn.example");
    }
  });
});

describe("signInLocation", () => {
  test("carries a safe next path", () => {
    expect(signInLocation("/learn/a?x=1")).toBe("/sign-in?next=%2Flearn%2Fa%3Fx%3D1");
  });

  test("drops an unsafe next path", () => {
    expect(signInLocation("https://evil.example")).toBe("/sign-in");
  });
});

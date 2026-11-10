import { describe, expect, test } from "vitest";
import { readCookie } from "../../src/auth/cookie-reader";

describe("readCookie", () => {
  test("finds a cookie among several", () => {
    expect(readCookie("a=1; __Host-heat_access=token; b=2", "__Host-heat_access")).toBe("token");
  });

  test("returns undefined for a missing header, a missing name or an empty value", () => {
    expect(readCookie(undefined, "a")).toBeUndefined();
    expect(readCookie("b=1", "a")).toBeUndefined();
    expect(readCookie("a=; b=1", "a")).toBeUndefined();
    expect(readCookie("novalue; b=1", "novalue")).toBeUndefined();
  });

  test("does not match a name that only shares a suffix or prefix", () => {
    expect(readCookie("xa=1; ab=2", "a")).toBeUndefined();
  });

  test("unquotes and decodes values, tolerating bad escapes", () => {
    expect(readCookie('a="x%20y"', "a")).toBe("x y");
    expect(readCookie("a=%E0%A4%A", "a")).toBe("%E0%A4%A");
  });

  test("joins repeated cookie headers", () => {
    expect(readCookie(["a=1", "b=2"], "b")).toBe("2");
  });

  test("keeps equals signs inside the value", () => {
    expect(readCookie("a=b=c", "a")).toBe("b=c");
  });
});

import { describe, expect, test } from "vitest";
import { LOCALES, type Locale } from "../src/locale";
import { switchLocalePath } from "../src/switch-locale-path";

describe("switchLocalePath", () => {
  test.each([
    ["/en", "bn", "/bn"],
    ["/en/", "bn", "/bn"],
    ["/bn", "en", "/en"],
    ["/bn/", "en", "/en"],
    ["/bn/x?y=1#z", "en", "/en/x?y=1#z"],
    ["/en/courses/x?tab=2#notes", "bn", "/bn/courses/x?tab=2#notes"],
    ["/en?y=1", "bn", "/bn?y=1"],
    ["/en#z", "bn", "/bn#z"],
    ["/en/a/b/c", "bn", "/bn/a/b/c"],
    ["/en/a%20b/%E0%A6%AC", "bn", "/bn/a%20b/%E0%A6%AC"],
    ["/x", "bn", "/bn/x"],
    ["/x/y?q=1", "en", "/en/x/y?q=1"],
    ["/", "en", "/en"],
    ["", "bn", "/bn"],
    ["/EN/x", "bn", "/bn/EN/x"],
    ["/english", "bn", "/bn/english"],
    ["/bn", "bn", "/bn"],
    ["/en/x", "en", "/en/x"],
  ] satisfies [string, Locale, string][])("%j to %s gives %j", (input, target, expected) => {
    expect(switchLocalePath(input, target)).toBe(expected);
  });

  test.each([
    ["//evil.com", "/bn/evil.com"],
    ["///evil.com", "/bn/evil.com"],
    ["/\\evil.com", "/bn"],
    ["/en//evil.com", "/bn/evil.com"],
    ["/en///evil.com/x", "/bn/evil.com/x"],
    ["/en/\\evil.com", "/bn"],
    ["/en/x\\y", "/bn"],
    ["javascript:alert(1)", "/bn"],
    ["JaVaScRiPt:alert(1)", "/bn"],
    ["https://evil.com", "/bn"],
    ["https://evil.com/en/x", "/bn"],
    ["evil.com", "/bn"],
    ["data:text/html,x", "/bn"],
    ["/en/../x", "/bn/x"],
    ["/en/./x", "/bn/x"],
    ["/en/%2e%2e//evil.com", "/bn/evil.com"],
    ["/en/%2E%2E/%2e%2E/evil.com", "/bn/evil.com"],
    ["/en/..//evil.com", "/bn/evil.com"],
    ["/en/x\r\nSet-Cookie: a=b", "/bn"],
    ["/en/x\u0000", "/bn"],
    ["/en/x?a=1\r\nX: y", "/bn/x"],
    ["/en/x?a=\\evil", "/bn/x"],
    ["/en/x#\\evil", "/bn/x"],
    ["/en/x?a=//evil.com#//evil.com", "/bn/x?a=//evil.com#//evil.com"],
  ])("neutralises %j as %j", (input, expected) => {
    expect(switchLocalePath(input, "bn")).toBe(expected);
  });

  test("never returns a double slash, a scheme or a backslash", () => {
    const pieces = [
      "/",
      "//",
      "\\",
      "en",
      "bn",
      "..",
      ".",
      "%2e",
      ":",
      "x",
      "?",
      "#",
      "a=b",
      "\n",
      "http:",
    ];
    let state = 12345;
    const next = () => (state = (state * 1103515245 + 12345) % 2147483648);
    for (let run = 0; run < 3000; run++) {
      const length = (next() % 7) + 1;
      const input = Array.from({ length }, () => pieces[next() % pieces.length]).join("");
      for (const target of LOCALES) {
        const result = switchLocalePath(input, target);
        expect(result.startsWith(`/${target}`)).toBe(true);
        expect(result.slice(`/${target}`.length)).toMatch(/^(?:[/?#].*)?$/s);
        const pathOnly = result.split(/[?#]/, 1)[0] ?? "";
        expect(pathOnly).not.toContain("//");
        expect(result).not.toContain("\\");
        expect(
          [...result].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127),
        ).toBe(false);
        expect(new URL(result, "https://learn.example").origin).toBe("https://learn.example");
      }
    }
  });
});

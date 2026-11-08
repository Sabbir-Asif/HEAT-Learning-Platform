import { describe, expect, test } from "vitest";
import { negotiateLocale } from "../src/negotiate";

const pick = (acceptLanguage: string | null | undefined, cookie?: string | null) =>
  negotiateLocale({ cookie, acceptLanguage });

describe("cookie", () => {
  test.each([
    ["bn", "en"],
    ["en", "bn"],
  ])("a %s cookie wins over Accept-Language %s", (cookie, header) => {
    expect(pick(header, cookie)).toBe(cookie);
  });

  test.each([
    "fr",
    "BN",
    "En",
    "",
    "bn;x",
    "bn ",
    " bn",
    "bn\r\n",
    "bn,en",
    "a".repeat(17),
    "x".repeat(2000),
  ])("ignores the cookie %j and lets Accept-Language decide", (cookie) => {
    expect(pick("en", cookie)).toBe("en");
    expect(pick("bn", cookie)).toBe("bn");
    expect(pick("fr", cookie)).toBe("bn");
  });

  test("a null or missing cookie is ignored", () => {
    expect(pick("en", null)).toBe("en");
    expect(pick("en", undefined)).toBe("en");
  });
});

describe("Accept-Language without a usable language", () => {
  test.each([
    undefined,
    null,
    "",
    " ",
    ",",
    ",,,",
    "fr",
    "*",
    "fr, de;q=0.9, *;q=0.1",
    "e",
    "enx",
    "-en",
    "en_US",
  ])("%j falls back to bn", (header) => {
    expect(pick(header)).toBe("bn");
  });
});

describe("Accept-Language matching", () => {
  test.each([
    ["en", "en"],
    ["bn", "bn"],
    ["en-US,en;q=0.9", "en"],
    ["bn-BD", "bn"],
    ["bn-IN", "bn"],
    ["EN-us", "en"],
    ["BN", "bn"],
    ["en-Latn-GB", "en"],
    ["  en  ", "en"],
    ["fr, en;q=0.5", "en"],
    ["fr-CA, bn;q=0.2, en;q=0.1", "bn"],
  ])("%j goes to %s", (header, expected) => {
    expect(pick(header)).toBe(expected);
  });
});

describe("quality values", () => {
  test.each([
    ["en;q=0.8, bn;q=0.9", "bn"],
    ["bn;q=0.8, en;q=0.9", "en"],
    ["bn;q=0.8, en", "en"],
    ["en;q=1, bn;q=1.000", "en"],
    ["bn;q=0.001, en;q=0.0009x", "bn"],
    ["en;q=0.5, bn;q=0.5", "en"],
    ["bn;q=0.5, en;q=0.5", "bn"],
    ["en, bn", "en"],
    ["bn, en", "bn"],
    ["en;Q=0.4, bn;Q=0.6", "bn"],
    ["en;level=1;q=0.4, bn;q=0.3", "en"],
    ["en;level=1, bn;q=0.3", "en"],
  ])("%j goes to %s", (header, expected) => {
    expect(pick(header)).toBe(expected);
  });

  test.each([
    "en;q=0",
    "en;q=0.0",
    "en;q=0.000",
    "en;q=abc",
    "en;q=",
    "en;q=1.5",
    "en;q=2",
    "en;q=-0.5",
    "en;q=0.5555",
    "en;q=.5",
    "en;q=5.",
    "en;q=1.0001",
    "en;q=0x1",
    "en;q=1e0",
    "en;q= 0.5",
    "en;q=0.5 x",
  ])("ignores the entry %j", (header) => {
    expect(pick(header)).toBe("bn");
    expect(pick(`${header}, bn;q=0.1`)).toBe("bn");
  });

  test("an ignored en does not beat a lower valid bn", () => {
    expect(pick("en;q=abc, bn;q=0.1")).toBe("bn");
    expect(pick("en;q=7, bn;q=0.1")).toBe("bn");
  });

  test("a valid en still beats a lower valid bn next to an ignored entry", () => {
    expect(pick("bn;q=abc, en;q=0.1")).toBe("en");
  });
});

describe("limits", () => {
  test("reads only the first 32 entries", () => {
    const filler = Array.from({ length: 32 }, () => "fr").join(",");
    expect(pick(`${filler},en`)).toBe("bn");
    const filler31 = Array.from({ length: 31 }, () => "fr").join(",");
    expect(pick(`${filler31},en`)).toBe("en");
  });

  test("counts empty entries towards the 32", () => {
    expect(pick(`${",".repeat(32)}en`)).toBe("bn");
  });

  test("reads only the first 1 KB", () => {
    const padding = "x".repeat(1024);
    expect(pick(`${padding},en`)).toBe("bn");
    expect(pick(`fr;x=${"y".repeat(1000)},en`)).toBe("en");
    expect(pick(`${"y".repeat(1021)},en`)).toBe("en");
    expect(pick(`${"y".repeat(1022)},en`)).toBe("bn");
  });

  test.each([
    ["a very long run of one letter", "a".repeat(1_000_000)],
    ["repeated separators", ";".repeat(1_000_000)],
    ["repeated parameters", `en${";q=".repeat(300_000)}`],
    ["repeated commas", ",".repeat(1_000_000)],
    ["repeated spaces", ` ${" ".repeat(1_000_000)}en`],
    ["nested quality", `en;q=${"0".repeat(1_000_000)}`],
  ])("finishes fast on %s", (_name, header) => {
    const started = performance.now();
    pick(header);
    expect(performance.now() - started).toBeLessThan(250);
  });
});

describe("hostile values", () => {
  test.each([
    "en\r\nSet-Cookie: x=1",
    "https://evil.example",
    "//evil.example",
    "bn\u0000",
    "\u0000",
    "en;q=0.5\r\nHost: evil.example",
  ])("returns only a supported locale for %j", (header) => {
    expect(["bn", "en"]).toContain(pick(header));
  });
});

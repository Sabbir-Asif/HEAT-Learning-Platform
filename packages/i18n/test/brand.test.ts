import { describe, expect, test } from "vitest";
import { compareKeys, flattenKeys, messages } from "../src/index";

const logoKeys = [
  "brand.logo.du",
  "brand.logo.gob",
  "brand.logo.heat",
  "brand.logo.ugc",
  "brand.logo.worldBank",
];

describe("flattenKeys", () => {
  test("lists dotted paths of every string leaf, sorted", () => {
    expect(flattenKeys({ b: { y: "1", x: "2" }, a: "3" })).toEqual({
      a: "3",
      "b.x": "2",
      "b.y": "1",
    });
  });
});

describe("compareKeys", () => {
  test("reports nothing when the key sets match", () => {
    expect(compareKeys({ a: { b: "x" } }, { a: { b: "y" } })).toEqual({ missing: [], extra: [] });
  });

  test("names a key missing from the candidate and one it adds", () => {
    expect(compareKeys({ a: { b: "x", c: "y" } }, { a: { b: "x" }, d: "z" })).toEqual({
      missing: ["a.c"],
      extra: ["d"],
    });
  });
});

describe("brand catalogs", () => {
  const en = flattenKeys({ brand: messages.en.brand });
  const bn = flattenKeys({ brand: messages.bn.brand });

  test("en defines the five logo keys", () => {
    expect(Object.keys(en).sort()).toEqual(logoKeys);
  });

  test("bn defines exactly the keys of en, and the comparison names any gap", () => {
    expect(compareKeys(messages.en, messages.bn)).toEqual({ missing: [], extra: [] });
  });

  test.each(logoKeys)("%s is non-empty in en and bn", (key) => {
    expect(en[key]?.trim().length).toBeGreaterThan(0);
    expect(bn[key]?.trim().length).toBeGreaterThan(0);
  });

  test("every bn alt text is written in Bangla script, and HEAT stays in Latin letters", () => {
    for (const [key, value] of Object.entries(bn))
      expect({ key, bangla: /[ঀ-৿]/.test(value) }).toEqual({ key, bangla: true });
    expect(bn["brand.logo.heat"]).toContain("HEAT");
  });

  test("no alt text repeats between logos", () => {
    expect(new Set(Object.values(en)).size).toBe(5);
    expect(new Set(Object.values(bn)).size).toBe(5);
  });
});

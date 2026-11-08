import { describe, expect, test } from "vitest";
import { compareKeys, flattenKeys, messages } from "../../src/index";

const logoKeys = [
  "brand.logo.du",
  "brand.logo.gob",
  "brand.logo.heat",
  "brand.logo.ugc",
  "brand.logo.worldBank",
];

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

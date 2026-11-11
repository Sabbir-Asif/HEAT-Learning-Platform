import { describe, expect, test } from "vitest";
import {
  nameBaseFontPx,
  nameFontSizePx,
  nameMinFontPx,
} from "../../src/certificate/certificate-name-fit";

describe("nameFontSizePx", () => {
  test("keeps the full size for short names", () => {
    expect(nameFontSizePx("Nusrat Jahan")).toBe(nameBaseFontPx);
    expect(nameFontSizePx("a".repeat(30))).toBe(nameBaseFontPx);
  });

  test("shrinks as the name grows", () => {
    expect(nameFontSizePx("a".repeat(45))).toBeLessThan(nameBaseFontPx);
    expect(nameFontSizePx("a".repeat(60))).toBeLessThan(nameFontSizePx("a".repeat(45)));
  });

  test("never goes below the minimum", () => {
    expect(nameFontSizePx("a".repeat(400))).toBe(nameMinFontPx);
  });

  test("counts characters rather than UTF-16 units", () => {
    expect(nameFontSizePx("\u{1F600}".repeat(30))).toBe(nameBaseFontPx);
  });
});

import { describe, expect, test } from "vitest";
import { contrastRatio, parseHex, relativeLuminance } from "../src/contrast.mjs";

describe("parseHex", () => {
  test("reads six digit hex in either case", () => {
    expect(parseHex("#1A2b3C")).toEqual([26, 43, 60]);
  });

  test("expands three digit hex", () => {
    expect(parseHex("#fff")).toEqual([255, 255, 255]);
    expect(parseHex("#0a8")).toEqual([0, 170, 136]);
  });

  test.each(["#ffffff80", "#ffff", "ffffff", "red", "#gggggg", "", "#12345", null, 7])(
    "rejects %s",
    (value) => {
      expect(() => parseHex(value)).toThrow(/hex/i);
    },
  );
});

describe("relativeLuminance", () => {
  test("is 0 for black and 1 for white", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 10);
  });

  test("weights green above red above blue", () => {
    const red = relativeLuminance("#ff0000");
    const green = relativeLuminance("#00ff00");
    const blue = relativeLuminance("#0000ff");
    expect(red).toBeCloseTo(0.2126, 4);
    expect(green).toBeCloseTo(0.7152, 4);
    expect(blue).toBeCloseTo(0.0722, 4);
  });
});

describe("contrastRatio", () => {
  test("black on white is 21", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 8);
  });

  test("equal colours give 1", () => {
    expect(contrastRatio("#5a2d91", "#5a2d91")).toBe(1);
  });

  test("is symmetric", () => {
    expect(contrastRatio("#5a2d91", "#fbfafd")).toBe(contrastRatio("#fbfafd", "#5a2d91"));
  });

  test("grey 777777 on white misses 4.5 and 767676 meets it", () => {
    expect(contrastRatio("#777777", "#ffffff")).toBeLessThan(4.5);
    expect(contrastRatio("#767676", "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  test("throws on an invalid colour", () => {
    expect(() => contrastRatio("#nothex", "#ffffff")).toThrow(/hex/i);
  });
});

import { expect, test } from "vitest";
import { contrastRatio, packageName } from "../src/index";

test("exports its package name", () => {
  expect(packageName).toBe("@heat/config");
});

test("exports the WCAG contrast ratio of two hex colours", () => {
  expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
});

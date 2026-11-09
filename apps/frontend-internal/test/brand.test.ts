import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import * as brand from "../src/shell/brand";

const publicDir = join(import.meta.dirname, "../public");
const logos = Object.values(brand).flatMap((value) =>
  Array.isArray(value) ? value : typeof value === "object" ? [value] : [],
);

test("every logo file exists and has alt text", () => {
  expect(logos.length).toBeGreaterThan(0);
  for (const logo of logos) {
    expect(existsSync(join(publicDir, logo.src))).toBe(true);
    expect(existsSync(join(publicDir, logo.darkSrc))).toBe(true);
    expect(logo.alt.length).toBeGreaterThan(0);
  }
});

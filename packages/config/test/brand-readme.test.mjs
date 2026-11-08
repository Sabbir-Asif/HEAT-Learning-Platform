import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { brandLocation } from "../src/brand.mjs";

const root = resolve(import.meta.dirname, "../../..");
const readme = readFileSync(resolve(root, "README.md"), "utf8");
const { sourceDir } = brandLocation(root);

const section = () => {
  const start = readme.indexOf("### Brand assets");
  if (start === -1) return "";
  const rest = readme.slice(start + 1);
  const next = rest.search(/\n### /);
  return next === -1 ? rest : rest.slice(0, next);
};

const rows = () =>
  section()
    .split("\n")
    .filter((line) => /^\|\s*`[^`]+\.svg`/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));

describe("README Brand assets", () => {
  test("has a Brand assets section under Development", () => {
    expect(section()).not.toBe("");
    expect(readme.indexOf("## Development")).toBeLessThan(readme.indexOf("### Brand assets"));
  });

  test("lists every source file with its source, a known status and an ISO date", () => {
    const listed = rows().map(([file]) => file.replaceAll("`", ""));
    const sources = readdirSync(sourceDir).sort();
    expect({ missing: sources.filter((name) => !listed.includes(name)) }).toEqual({ missing: [] });
    expect({ unknown: listed.filter((name) => !sources.includes(name)) }).toEqual({ unknown: [] });
    for (const [file, organisation, source, status, date] of rows()) {
      expect({ file, organisation: organisation.length > 0, source: source.length > 0 }).toEqual({
        file,
        organisation: true,
        source: true,
      });
      expect({ file, status: ["traced", "placeholder", "original"].includes(status) }).toEqual({
        file,
        status: true,
      });
      expect({ file, date: /^\d{4}-\d{2}-\d{2}$/.test(date) }).toEqual({ file, date: true });
    }
  });

  test("says the owner's vectors replace these files before launch", () => {
    const text = section().replace(/\s+/g, " ");
    expect(text).toMatch(/owner's original vectors replace/i);
    expect(text).toMatch(/before launch/i);
  });

  test("says the marks are third-party and gives the replacement command", () => {
    const text = section().replace(/\s+/g, " ");
    expect(text).toMatch(/third-party/i);
    expect(text).toMatch(/usage terms/i);
    expect(text).toContain("pnpm brand");
  });

  test("records the tracing tool, its version and settings", () => {
    const text = section();
    expect(text).toMatch(/vtracer/);
    expect(text).toMatch(/0\.6\.15/);
    expect(text).toMatch(/color_precision/);
  });
});

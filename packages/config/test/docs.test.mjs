import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { expect, test } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const read = (path) => readFileSync(join(root, path), "utf8");

const areas = [
  "apps/frontend-public",
  "apps/frontend-internal",
  "apps/api",
  "apps/worker",
  "packages/ui",
  "packages/db",
  "packages/contracts",
];
const areaFiles = areas.map((area) => `${area}/CLAUDE.md`);
const lines = (text) => text.split("\n");

test("the root CLAUDE.md stays under 200 lines", () => {
  expect(lines(read("CLAUDE.md").trimEnd()).length).toBeLessThan(200);
});

test("every area has a CLAUDE.md and the root links to it and to docs/adr/", () => {
  const rootText = read("CLAUDE.md");
  const missing = areaFiles.filter((file) => !existsSync(join(root, file)));
  const unlinked = [...areaFiles, "docs/adr/"].filter(
    (target) => !rootText.includes(`](${target})`),
  );
  expect({ missing, unlinked }).toEqual({ missing: [], unlinked: [] });
});

test("every area CLAUDE.md links back to the root file", () => {
  const unlinked = areaFiles.filter((file) => !read(file).includes("(../../CLAUDE.md"));
  expect(unlinked).toEqual([]);
});

test("relative links in the instruction files resolve", () => {
  const broken = ["CLAUDE.md", ...areaFiles, "docs/adr/README.md"].flatMap((file) => {
    const links = [...read(file).matchAll(/\]\(([^)\s]+)\)/g)].map((match) => match[1]);
    return links
      .filter((link) => !/^[a-z]+:|^#/.test(link))
      .map((link) => ({ file, link, target: resolve(root, dirname(file), link.split("#")[0]) }))
      .filter(({ target }) => !existsSync(target))
      .map(({ file, link }) => `${file}: ${link}`);
  });
  expect(broken).toEqual([]);
});

test("a rule is written in one file only: area files do not repeat root lines", () => {
  const long = (text) =>
    lines(text)
      .map((line) => line.trim())
      .filter((line) => line.length >= 40);
  const rootLines = new Set(long(read("CLAUDE.md")));
  const repeated = areaFiles.flatMap((file) =>
    long(read(file))
      .filter((line) => rootLines.has(line))
      .map((line) => `${file}: ${line}`),
  );
  const seen = new Map();
  for (const file of areaFiles) {
    for (const line of long(read(file))) {
      if (seen.has(line)) repeated.push(`${seen.get(line)} and ${file}: ${line}`);
      else seen.set(line, file);
    }
  }
  expect(repeated).toEqual([]);
});

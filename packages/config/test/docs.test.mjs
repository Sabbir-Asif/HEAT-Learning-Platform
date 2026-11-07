import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
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
  "packages/api-client",
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

const slug = (heading) =>
  heading
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .replace(/ /g, "-");
const anchors = (file) =>
  lines(read(file))
    .filter((line) => /^#{1,6} /.test(line))
    .map((line) => slug(line.replace(/^#+ /, "")));

test("relative links and heading anchors in the instruction files resolve", () => {
  const adrFiles = readdirSync(join(root, "docs/adr"))
    .filter((file) => file.endsWith(".md"))
    .map((file) => `docs/adr/${file}`);
  const broken = ["CLAUDE.md", ...areaFiles, ...adrFiles].flatMap((file) => {
    const links = [...read(file).matchAll(/\]\(([^)\s]+)\)/g)].map((match) => match[1]);
    return links
      .filter((link) => !/^[a-z]+:/.test(link))
      .filter((link) => {
        const [path, anchor] = link.split("#");
        const target = path ? resolve(root, dirname(file), path) : join(root, file);
        if (!target.startsWith(root + sep) || !existsSync(target)) return true;
        if (!anchor) return false;
        if (target.endsWith(".html"))
          return !new RegExp(`\\sid="${anchor}"`).test(read(relative(root, target)));
        return !(target.endsWith(".md") && anchors(relative(root, target)).includes(anchor));
      })
      .map((link) => `${file}: ${link}`);
  });
  expect(broken).toEqual([]);
});

test("a rule is written in one file only: no sentence is repeated between files", () => {
  // Sentences are compared as lower-case words, so wrapping, punctuation and
  // markup do not hide a copy. Short sentences are ignored, and so is each area
  // file's intro, which only names the area and points to the root file.
  const sentences = (file) =>
    read(file)
      .replace(file === "CLAUDE.md" ? /^$/ : /^[\s\S]*?(?=^## )/m, "")
      .replace(/```[\s\S]*?```/g, "")
      .split(/(?<=[.;:!?])\s+|\n/)
      .map((sentence) =>
        sentence
          .toLowerCase()
          .replace(/[^\p{L}\p{N} ]/gu, " ")
          .split(/\s+/)
          .filter(Boolean),
      )
      .filter((words) => words.length >= 6)
      .map((words) => words.join(" "));
  const owner = new Map();
  const repeated = [];
  for (const file of ["CLAUDE.md", ...areaFiles]) {
    for (const sentence of new Set(sentences(file))) {
      if (owner.has(sentence)) repeated.push(`${owner.get(sentence)} and ${file}: ${sentence}`);
      else owner.set(sentence, file);
    }
  }
  expect(repeated).toEqual([]);
});

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, expect, test } from "vitest";
import { load as parse } from "js-yaml";

// Checks the /implement-issue skill and its agents (issue #24): the parts a careless edit would
// break without any test noticing.
const root = resolve(import.meta.dirname, "../../..");
const skillDir = ".claude/skills/implement-issue";
const skillFile = `${skillDir}/SKILL.md`;
const agents = ["refiner", "reviewer", "security-reviewer"];
const agentFiles = agents.map((agent) => `.claude/agents/${agent}.md`);
const read = (path) => readFileSync(join(root, path), "utf8");

function frontmatter(file) {
  const match = read(file).match(/^---\n([\s\S]*?)\n---\n/);
  return match ? parse(match[1]) : {};
}

function markdownFiles(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.name.endsWith(".md") ? [path] : [];
  });
}

describe("the implement-issue skill", () => {
  const text = () => read(skillFile);

  test("has a name matching its directory and a description that says when to use it", () => {
    const { name, description } = frontmatter(skillFile);
    expect(name).toBe("implement-issue");
    expect(description).toMatch(/\/implement-issue/);
    expect(description.length).toBeLessThanOrEqual(1024);
  });

  test("never reads the ticket JSON through pnpm", () => {
    expect(text()).not.toMatch(/pnpm[^\n]*ticket load/);
  });

  test("stays under 500 lines", () => {
    expect(text().split("\n").length).toBeLessThan(500);
  });

  test("names the eight stages in order", () => {
    const stages = [
      "Pull ticket",
      "Refine",
      "Branch",
      "Brainstorm and plan",
      "Implement",
      "Verify",
      "Code review",
      "Pull request",
    ];
    const headings = [...text().matchAll(/^## (\d)\. (.+)$/gm)].map((m) => [Number(m[1]), m[2]]);
    expect(headings).toEqual(
      stages.map((stage, index) => [index + 1, expect.stringContaining(stage)]),
    );
  });

  test("uses every pnpm ticket command and every agent", () => {
    const missing = [
      // pnpm prints its own error line to stdout on a non-zero exit, which would corrupt the JSON.
      'node packages/config/bin/ticket.mjs load $N > "$SCRATCH/ticket-$N.json"',
      "pnpm ticket refine",
      "pnpm ticket move $N start",
      "pnpm ticket move $N review",
      ...agents.map((agent) => `\`${agent}\``),
    ].filter((needle) => !text().includes(needle));
    expect(missing).toEqual([]);
  });

  test("relative links in the skill resolve", () => {
    const broken = markdownFiles(skillDir).flatMap((file) =>
      [...read(file).matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)]
        .map((match) => match[1])
        .filter((link) => !/^[a-z]+:/.test(link))
        .filter((link) => {
          const target = resolve(root, dirname(file), link);
          return !target.startsWith(root + sep) || !existsSync(target);
        })
        .map((link) => `${relative(root, file)}: ${link}`),
    );
    expect(broken).toEqual([]);
  });
});

describe("the agents", () => {
  test.each(agentFiles)("%s has a matching name, a description and read-only tools", (file) => {
    const { name, description, tools } = frontmatter(file);
    expect(`.claude/agents/${name}.md`).toBe(file);
    expect(description).toBeTruthy();
    const list = tools.split(",").map((tool) => tool.trim());
    expect(
      list.filter((tool) => ["Write", "Edit", "NotebookEdit", "Agent"].includes(tool)),
    ).toEqual([]);
  });
});

test("a dangerous command appears only in a sentence that forbids it", () => {
  const danger = /co-authored-by|generated with|--force|gh pr merge|migrate reset|\.env\b/i;
  const allowed = /\bnever\b|\bdo not\b|\bdon't\b|\bnot\b/i;
  const offending = [".claude/skills", ".claude/agents"].flatMap((dir) =>
    markdownFiles(dir).flatMap((file) =>
      read(file)
        .split("\n")
        .filter((line) => danger.test(line) && !allowed.test(line))
        .map((line) => `${file}: ${line.trim()}`),
    ),
  );
  expect(offending).toEqual([]);
});

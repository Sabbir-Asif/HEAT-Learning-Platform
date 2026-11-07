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

  test("stage 6 ends with pnpm verify, which writes the marker the pull request gate checks", () => {
    const verify = text()
      .split(/^## 7\./m)[0]
      .split(/^## 6\./m)[1];
    expect(verify).toContain("pnpm verify");
    expect(verify.indexOf("pnpm verify")).toBeGreaterThan(verify.indexOf("pnpm build"));
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

// The forbidding word must come before the dangerous token in the same sentence.
const dangerToken = String.raw`co-authored-by|generated with|--force|gh pr merge|migrate reset|\.env\b|environment files`;
const danger = new RegExp(dangerToken, "i");
const forbidden = new RegExp(String.raw`\b(?:never|do not|don't|no)\b[^.]*(?:${dangerToken})`, "i");
const unsafeLine = (line) => danger.test(line) && !forbidden.test(line);

test("a dangerous command appears only in a sentence that forbids it", () => {
  const offending = [".claude/skills", ".claude/agents"].flatMap((dir) =>
    markdownFiles(dir).flatMap((file) =>
      read(file)
        .split("\n")
        .filter(unsafeLine)
        .map((line) => `${file}: ${line.trim()}`),
    ),
  );
  expect(offending).toEqual([]);
});

test.each([
  ["Run `gh pr merge` when checks are not red.", true],
  ["Then `gh pr merge` it. Never force-push.", true],
  ["Never run `gh pr merge`.", false],
  ["No `Co-Authored-By` lines.", false],
])("the guard flags %j: %s", (line, flagged) => {
  expect(unsafeLine(line)).toBe(flagged);
});

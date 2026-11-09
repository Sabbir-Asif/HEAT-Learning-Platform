import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { hookSpecs } from "../src/hooks/run.mjs";

const root = resolve(import.meta.dirname, "../../..");
const settings = JSON.parse(readFileSync(resolve(root, ".claude/settings.json"), "utf8"));
const command = /^node "\$CLAUDE_PROJECT_DIR\/packages\/config\/bin\/hook\.mjs" ([a-z-]+)$/;
const guards = ["branch-guard", "danger-guard", "pr-gate"];

const wired = Object.entries(settings.hooks).flatMap(([event, groups]) =>
  groups.flatMap((group) =>
    group.hooks.map((hook) => ({ event, matcher: group.matcher ?? null, hook })),
  ),
);
const nameOf = (entry) => command.exec(entry.hook.command)?.[1];

describe("hook wiring", () => {
  test("every hook is a command that calls the runner with a known hook name", () => {
    for (const entry of wired) {
      expect(entry.hook.type).toBe("command");
      expect(nameOf(entry), entry.hook.command).toBeTruthy();
      expect(Object.keys(hookSpecs)).toContain(nameOf(entry));
    }
  });

  test("each hook sits under the event its code expects", () => {
    for (const entry of wired) expect(hookSpecs[nameOf(entry)].event).toBe(entry.event);
  });

  test("all seven hooks are wired", () => {
    expect([...new Set(wired.map(nameOf))].sort()).toEqual(Object.keys(hookSpecs).sort());
    expect(Object.keys(hookSpecs)).toHaveLength(7);
  });

  test("the guards block when they fail or time out; the others never do", () => {
    for (const entry of wired) {
      expect(entry.hook.onFailure === "block", nameOf(entry)).toBe(guards.includes(nameOf(entry)));
    }
  });

  test("every hook has a timeout in seconds, and the stop check has room for a typecheck", () => {
    for (const entry of wired) {
      expect(entry.hook.timeout).toBeGreaterThan(0);
      expect(entry.hook.timeout).toBeLessThanOrEqual(120);
    }
    expect(
      wired.find((entry) => nameOf(entry) === "stop-check").hook.timeout,
    ).toBeGreaterThanOrEqual(110);
  });

  test("matchers are valid expressions and events without matchers have none", () => {
    for (const entry of wired) {
      if (entry.matcher !== null) expect(() => new RegExp(entry.matcher)).not.toThrow();
    }
    for (const event of ["UserPromptSubmit", "Stop"]) {
      expect(
        wired.filter((entry) => entry.event === event).every((entry) => entry.matcher === null),
      ).toBe(true);
    }
  });

  test("file tools run the branch guard and danger guard; Bash runs the danger guard and PR gate", () => {
    const names = (tool) =>
      wired
        .filter(
          (entry) =>
            entry.event === "PreToolUse" && new RegExp(`^(?:${entry.matcher})$`).test(tool),
        )
        .map(nameOf)
        .sort();
    for (const tool of ["Edit", "Write", "NotebookEdit"]) {
      expect(names(tool)).toEqual(["branch-guard", "danger-guard"]);
    }
    expect(names("Bash")).toEqual(["danger-guard", "pr-gate"]);
    for (const tool of ["Read", "Grep", "Glob"]) expect(names(tool)).toEqual(["danger-guard"]);
    expect(names("WebFetch")).toEqual([]);
  });

  test("the formatter runs after Edit and Write, the loader on every session start", () => {
    const post = wired.filter((entry) => entry.event === "PostToolUse");
    expect(post.map(nameOf)).toEqual(["formatter"]);
    expect(post[0].matcher).toMatch(/Edit/);
    const start = wired.find((entry) => entry.event === "SessionStart");
    for (const source of ["startup", "resume", "clear", "compact"]) {
      expect(new RegExp(`^(?:${start.matcher})$`).test(source)).toBe(true);
    }
  });
});

const globToRegExp = (glob) =>
  new RegExp(
    `^${glob
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, "[^/]*")
      .replace(/\?/g, "[^/]")}$`,
  );

function pathRules(tool) {
  return settings.permissions.deny
    .map((rule) => new RegExp(`^${tool}\\((.*)\\)$`).exec(rule)?.[1])
    .filter((pattern) => pattern !== undefined);
}

function pathDenied(tool, path) {
  let denied = false;
  for (const rule of pathRules(tool)) {
    const negated = rule.startsWith("!");
    const pattern = negated ? rule.slice(1) : rule;
    const segments = path.split("/");
    if (segments.some((segment) => globToRegExp(pattern).test(segment))) denied = !negated;
  }
  return denied;
}

describe("permissions.deny for environment files", () => {
  test.each(["Read", "Edit"])("%s denies env files at any depth", (tool) => {
    for (const path of [
      ".env",
      "apps/api/.env",
      ".env.local",
      ".env.production",
      "infra/compose/.env.staging",
      "prod.env",
      "deploy/staging.env",
      ".envrc",
    ]) {
      expect(pathDenied(tool, path), path).toBe(true);
    }
  });

  test.each(["Read", "Edit"])("%s leaves .env.example and ordinary files alone", (tool) => {
    for (const path of [
      ".env.example",
      "apps/api/.env.example",
      "infra/compose/.env.example",
      "docs/guide/page.md",
      ".claude/settings.json",
      "packages/config/src/hooks/env-files.mjs",
      "packages/config/test/hooks/danger-guard.secrets.test.mjs",
      "apps/frontend-public/src/environment.ts",
      "README.md",
    ]) {
      expect(pathDenied(tool, path), path).toBe(false);
    }
  });

  test("the local settings file cannot be edited", () => {
    expect(pathRules("Edit")).toContain("**/.claude/settings.local.json");
  });

  test("Write is covered through Edit, as the permission syntax defines", () => {
    expect(pathRules("Write")).toEqual([]);
    expect(pathRules("Edit").length).toBeGreaterThan(0);
  });
});

const bashGlob = (pattern) =>
  new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
const bashRules = settings.permissions.deny
  .map((rule) => /^Bash\((.*)\)$/.exec(rule)?.[1])
  .filter(Boolean)
  .map(bashGlob);

describe("permissions.deny for Bash", () => {
  test.each([
    "git push --force",
    "git push --force-with-lease origin x",
    "git push -f origin x",
    "git push -fu origin x",
    "prisma migrate reset",
    "pnpm exec prisma migrate reset --force",
    "npx prisma migrate reset",
  ])("denies %s", (text) => {
    expect(bashRules.some((rule) => rule.test(text))).toBe(true);
  });

  test.each([
    "pnpm install --frozen-lockfile",
    "pnpm ticket move 25 start",
    'node packages/config/bin/ticket.mjs load 25 > "$SCRATCH/ticket-25.json"',
    "git fetch origin",
    "git worktree add -b chore/25-x ../heat-lp-25 origin/epic/e0-engineering-foundation",
    "git -C ../heat-lp-25 branch --unset-upstream",
    'git add -A && git commit -m "docs: add plan (#25)"',
    "git push -u origin chore/25-x",
    "git push",
    "git push --follow-tags",
    "git push --set-upstream origin chore/25-x",
    "pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm build",
    "pnpm verify",
    "pnpm generate",
    "pnpm format",
    "pnpm dev:up",
    "pnpm dev:reset",
    "pnpm exec prisma migrate deploy",
    "pnpm exec prisma generate",
    'gh issue comment 25 --body-file "$SCRATCH/plan.md"',
    'gh pr create --base epic/e0 --head chore/25-x --title "t" --body-file "$SCRATCH/pr.md"',
    "pnpm ticket move 25 review",
    "gh pr checks 7 --watch",
    "git log --oneline",
    'rg "prisma migrate reset" docs',
    "cat .env.example",
  ])("does not touch the skill's normal command %s", (text) => {
    expect(
      bashRules.some((rule) => rule.test(text)),
      text,
    ).toBe(false);
  });
});

test("the settings carry only hooks and permissions", () => {
  expect(Object.keys(settings).sort()).toEqual(["hooks", "permissions"]);
  expect(Object.keys(settings.permissions)).toEqual(["deny"]);
});

import { symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { cleanupAll, tempDir } from "../fixtures/repo.mjs";
import { dangerGuard } from "../../src/hooks/danger-guard.mjs";

afterAll(cleanupAll);

const use = (tool_name, tool_input) => dangerGuard({ tool_name, tool_input, cwd: "/tmp" });

describe("environment files through the file tools", () => {
  test.each([
    ["Read", { file_path: "/w/apps/api/.env" }],
    ["Read", { file_path: "/w/.ENV" }],
    ["Read", { file_path: "/w/prod.env" }],
    ["Grep", { pattern: "KEY", path: "/w/apps/api/.env" }],
    ["Grep", { pattern: "KEY", path: "/w", glob: ".env*" }],
    ["Glob", { pattern: "**/.env" }],
    ["Glob", { pattern: "*.env", path: "/w" }],
    ["Edit", { file_path: "/w/.env.local", old_string: "a", new_string: "b" }],
    ["Write", { file_path: "/w/.envrc", content: "x" }],
    ["NotebookEdit", { notebook_path: "/w/.env" }],
    ["MultiEdit", { file_path: "/w/.env", edits: [] }],
  ])("denies %s %j", (tool, input) => {
    expect(use(tool, input).deny).toMatch(/environment files/i);
  });

  test.each([
    ["Read", { file_path: "/w/apps/api/.env.example" }],
    ["Read", { file_path: "/w/README.md" }],
    ["Grep", { pattern: "KEY", path: "/w/src" }],
    ["Grep", { pattern: "KEY" }],
    ["Glob", { pattern: "**/*.ts" }],
    ["Glob", {}],
  ])("allows %s %j", (tool, input) => {
    expect(use(tool, input)).toEqual({});
  });

  test("tools it does not know are left alone", () => {
    expect(use("WebFetch", { url: "https://example.com/.env" })).toEqual({});
    expect(dangerGuard({ tool_name: "Read" })).toEqual({});
  });
});

describe("environment files through Bash", () => {
  const bash = (command) =>
    dangerGuard({ tool_name: "Bash", tool_input: { command }, cwd: "/tmp" });

  test("denies a reader and names the file", () => {
    expect(bash("cat apps/api/.env").deny).toContain("apps/api/.env");
  });

  test.each([
    "rg process.env",
    "grep -rn process.env apps",
    "git grep process.env",
    "rg import.meta.env",
    "grep -rn 'next.env' .",
    "git log -S process.env",
  ])("allows searching the code for %s", (command) => {
    expect(bash(command)).toEqual({});
  });

  test.each([
    "cat <<EOF\n$(cat .env)\nEOF",
    "echo ${x:-$(cat .env)}",
    "cat <<EOF\n`cat apps/api/.env`\nEOF",
  ])("denies a substitution hidden in %j", (command) => {
    expect(bash(command).deny).toMatch(/environment files/i);
  });

  test("allows heredocs that only carry text", () => {
    expect(
      bash("gh issue comment 25 --body-file - <<'EOF'\nmentions .env and $(cat .env)\nEOF"),
    ).toEqual({});
    expect(bash("git commit -F - <<EOF\nnever read .env files\nEOF")).toEqual({});
  });

  test("allows the commands the workflow uses", () => {
    expect(bash("git add .env.example && git commit -m 'never read .env files'")).toEqual({});
  });
});

describe("symlinks to environment files", () => {
  const dir = tempDir("links");
  writeFileSync(join(dir, ".env"), "SECRET=1\n");
  writeFileSync(join(dir, ".env.example"), "SECRET=\n");
  symlinkSync(join(dir, ".env"), join(dir, "notes.txt"));
  symlinkSync(join(dir, ".env.example"), join(dir, "example.txt"));
  symlinkSync(dir, join(dir, "self"));
  const innocent = join(dir, "notes.txt");

  test.each([
    ["Read", { file_path: innocent }],
    ["Edit", { file_path: innocent }],
    ["Write", { file_path: innocent }],
    ["NotebookEdit", { notebook_path: innocent }],
    ["Grep", { pattern: "S", path: innocent }],
    ["Glob", { pattern: "*", path: innocent }],
    ["Read", { file_path: join(dir, "self", "notes.txt") }],
  ])("denies %s through a symlink: %j", (tool, input) => {
    expect(use(tool, input).deny).toMatch(/environment files/i);
  });

  test("a symlink to .env.example stays readable", () => {
    expect(use("Read", { file_path: join(dir, "example.txt") })).toEqual({});
  });

  test("a relative symlink path is resolved against the session directory", () => {
    const result = dangerGuard({
      tool_name: "Read",
      tool_input: { file_path: "notes.txt" },
      cwd: dir,
    });
    expect(result.deny).toMatch(/environment files/i);
  });
});

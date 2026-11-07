import { describe, expect, test } from "vitest";
import { dangerGuard } from "../../src/hooks/danger-guard.mjs";

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

  test("allows the commands the workflow uses", () => {
    expect(bash("git add .env.example && git commit -m 'never read .env files'")).toEqual({});
  });
});

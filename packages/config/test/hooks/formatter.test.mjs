import { mkdirSync, readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { formatter } from "../../src/hooks/formatter.mjs";
import { readState } from "../../src/hooks/state.mjs";
import { addWorktree, cleanupAll, makeRepo, tempDir, write } from "../fixtures/repo.mjs";

afterAll(cleanupAll);

let tree;
let env;
let calls;
let results;

const run = (command, args, options) => {
  calls.push({ command, args, cwd: options.cwd });
  return results.shift() ?? { status: 0, output: "" };
};
const edit = (file, extra = {}) =>
  formatter(
    { tool_name: "Write", tool_input: { file_path: file }, session_id: "s1", cwd: tree, ...extra },
    { env, run },
  );

function scaffold() {
  write(tree, "package.json", "{}\n");
  write(tree, "node_modules/.bin/prettier");
  write(tree, "node_modules/.bin/eslint");
  write(tree, "packages/config/package.json", "{}\n");
  write(tree, "packages/config/eslint.config.js", "export default [];\n");
  write(tree, "packages/config/src/a.mjs", "a\n");
  write(tree, "packages/config/src/b.ts", "b\n");
  write(tree, "packages/config/README.md", "r\n");
  write(tree, "packages/config/notes.json", "{}\n");
}

beforeEach(() => {
  tree = addWorktree(makeRepo(), "chore/50-format");
  env = { HEAT_HOOKS_STATE_DIR: tempDir("state") };
  calls = [];
  results = [];
  scaffold();
});

const bins = () => calls.map((call) => call.command.split("/").at(-1));

describe("what it runs", () => {
  test("ESLint fixes the file, then Prettier writes it, both from the package directory", () => {
    const file = join(tree, "packages/config/src/a.mjs");
    expect(edit(file)).toEqual({});
    expect(bins()).toEqual(["eslint", "prettier"]);
    expect(calls.map((call) => call.cwd)).toEqual([
      join(tree, "packages/config"),
      join(tree, "packages/config"),
    ]);
    expect(calls[0].args).toEqual(["--fix", "--no-warn-ignored", file]);
    expect(calls[1].args).toEqual([
      "--write",
      "--ignore-unknown",
      "--ignore-path",
      join(tree, ".gitignore"),
      file,
    ]);
  });

  test("a package with its own .prettierignore adds it, like its format:check script", () => {
    write(tree, "packages/config/.prettierignore", "x\n");
    edit(join(tree, "packages/config/src/a.mjs"));
    expect(calls[1].args).toContain(join(tree, "packages/config/.prettierignore"));
  });

  test("a root file uses the default ignore files and no ESLint", () => {
    edit(join(tree, "package.json"));
    expect(bins()).toEqual(["prettier"]);
    expect(calls[0].cwd).toBe(tree);
    expect(calls[0].args).toEqual(["--write", "--ignore-unknown", join(tree, "package.json")]);
  });

  test("ESLint is only used for script files in a package with an ESLint config", () => {
    edit(join(tree, "packages/config/README.md"));
    edit(join(tree, "packages/config/notes.json"));
    expect(bins()).toEqual(["prettier", "prettier"]);
    calls.length = 0;
    write(tree, "apps/web/package.json", "{}\n");
    write(tree, "apps/web/src/c.ts", "c\n");
    edit(join(tree, "apps/web/src/c.ts"));
    expect(bins()).toEqual(["prettier"]);
  });

  test("the binary is taken from the package's node_modules before the root's", () => {
    write(tree, "packages/config/node_modules/.bin/prettier");
    edit(join(tree, "packages/config/README.md"));
    expect(calls[0].command).toBe(join(tree, "packages/config/node_modules/.bin/prettier"));
  });

  test("NotebookEdit paths are formatted like any other", () => {
    edit(join(tree, "packages/config/README.md"), {
      tool_input: { notebook_path: join(tree, "packages/config/README.md") },
    });
    expect(bins()).toEqual(["prettier"]);
  });
});

describe("what it leaves alone", () => {
  test.each([
    "docs/guide/other.md",
    "packages/api-client/src/generated/hooks.ts",
    "apps/api/openapi.json",
    "assets/logo.png",
    "assets/photo.JPG",
    "assets/font.woff2",
  ])("%s", (relative) => {
    const file = write(tree, relative);
    expect(edit(file)).toEqual({});
    expect(calls).toEqual([]);
  });

  test("a file that does not exist", () => {
    expect(edit(join(tree, "gone/missing.ts"))).toEqual({});
    expect(calls).toEqual([]);
  });

  test("a file outside any repository", () => {
    const file = write(tempDir("scratch"), "notes.md");
    expect(edit(file)).toEqual({});
    expect(calls).toEqual([]);
  });
});

describe("reporting", () => {
  test("unfixable ESLint problems come back as context without failing", () => {
    results = [{ status: 1, output: "a.mjs\n  1:1  error  no-undef  'x' is not defined\n" }];
    const result = edit(join(tree, "packages/config/src/a.mjs"));
    expect(result.context).toMatch(/ESLint/);
    expect(result.context).toContain("no-undef");
    expect(bins()).toEqual(["eslint", "prettier"]);
  });

  test("a Prettier failure is reported in one note", () => {
    results = [
      { status: 0, output: "" },
      { status: 2, output: "SyntaxError: Unexpected token" },
    ];
    const result = edit(join(tree, "packages/config/src/a.mjs"));
    expect(result.context).toMatch(/Prettier/);
    expect(result.context).toContain("SyntaxError");
  });

  test("a missing node_modules skips with one line", () => {
    const bare = addWorktree(makeRepo(), "chore/51-bare");
    write(bare, "package.json", "{}\n");
    const result = formatter(
      { tool_input: { file_path: join(bare, "a.md") }, session_id: "s1" },
      { env, run },
    );
    expect(result).toEqual({});
    write(bare, "a.md");
    const noted = formatter(
      { tool_input: { file_path: join(bare, "a.md") }, session_id: "s1" },
      { env, run },
    );
    expect(noted.context).toMatch(/node_modules/);
    expect(noted.context.split("\n")).toHaveLength(1);
    expect(calls).toEqual([]);
  });

  test("very long output is cut", () => {
    results = [{ status: 1, output: "e".repeat(10000) }];
    expect(edit(join(tree, "packages/config/src/a.mjs")).context.length).toBeLessThan(2500);
  });
});

describe("recording for the stop check", () => {
  test("a typed file marks the worktree dirty even when formatting is skipped", () => {
    edit(write(tree, "packages/api-client/src/generated/x.ts"));
    expect(readState("s1", env)).toMatchObject({ worktree: tree, typedDirty: true });
  });

  test.each([
    "packages/config/src/b.ts",
    "apps/web/tsconfig.json",
    "packages/config/package.json",
    "src/c.tsx",
  ])("%s counts as typed", (relative) => {
    edit(write(tree, relative));
    expect(readState("s1", env).typedDirty).toBe(true);
  });

  test.each(["packages/config/src/a.mjs", "packages/config/README.md", "docs/x.md"])(
    "%s does not",
    (relative) => {
      edit(write(tree, relative));
      expect(readState("s1", env)).toMatchObject({ typedDirty: false, worktree: null });
    },
  );
});

describe("with the real Prettier and ESLint", () => {
  test("fixes and formats a file in a throwaway package", () => {
    const repo = addWorktree(makeRepo(), "chore/52-real");
    const realModules = join(import.meta.dirname, "../../node_modules");
    symlinkSync(realModules, join(repo, "node_modules"));
    write(repo, "package.json", "{}\n");
    write(repo, "eslint.config.mjs", 'export default [{ rules: { "no-var": "error" } }];\n');
    mkdirSync(join(repo, "pkg"), { recursive: true });
    write(repo, "pkg/package.json", "{}\n");
    write(repo, "pkg/eslint.config.mjs", 'export default [{ rules: { "no-var": "error" } }];\n');
    const file = write(repo, "pkg/a.js", "var   x = {a:1}\n");
    const result = formatter(
      { tool_input: { file_path: file }, session_id: "real", cwd: repo },
      { env },
    );
    expect(result).toEqual({});
    expect(readFileSync(file, "utf8")).toBe("let x = { a: 1 };\n");
  });

  test("leaves a file that .gitignore lists untouched", () => {
    const repo = addWorktree(makeRepo(), "chore/53-ignored");
    symlinkSync(join(import.meta.dirname, "../../node_modules"), join(repo, "node_modules"));
    write(repo, "package.json", "{}\n");
    write(repo, "pkg/package.json", "{}\n");
    write(repo, ".gitignore", "pkg/skip.json\n");
    const file = write(repo, "pkg/skip.json", '{"a":1}\n');
    formatter({ tool_input: { file_path: file }, session_id: "real", cwd: repo }, { env });
    expect(readFileSync(file, "utf8")).toBe('{"a":1}\n');
  });
});

import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { dangerGuard } from "../../src/hooks/danger-guard.mjs";
import { addWorktree, cleanupAll, git, makeRepo, tempDir, write } from "../fixtures/repo.mjs";

afterAll(cleanupAll);

let main;
let tree;
let gitDir;

beforeAll(() => {
  main = makeRepo({ branch: "epic/e0-x" });
  tree = addWorktree(main, "chore/60-gitdir");
  write(tree, "docs/plans/issue-60.md");
  gitDir = git(tree, "rev-parse", "--absolute-git-dir");
});

const file = (tool, path) =>
  dangerGuard({ tool_name: tool, tool_input: { file_path: path }, cwd: tree });
const bash = (command, cwd = tree) =>
  dangerGuard({ tool_name: "Bash", tool_input: { command }, cwd });

describe("file tools", () => {
  test.each([
    () => join(main, ".git/hooks/pre-commit"),
    () => join(main, ".git/config"),
    () => join(main, ".git/info/exclude"),
    () => join(tree, ".git"),
    () => join(gitDir, "heat-verified"),
    () => join(main, ".git/worktrees/tree/heat-verified"),
    () => join(tempDir("anywhere"), "heat-verified"),
  ])("denies Write and Edit on %#", (path) => {
    for (const tool of ["Write", "Edit", "MultiEdit"]) {
      expect(file(tool, path()).deny, tool).toMatch(/\.git|heat-verified/);
    }
  });

  test("a symlink into .git is resolved before the check", async () => {
    const { symlinkSync } = await import("node:fs");
    const link = join(tempDir("links"), "hooks");
    symlinkSync(join(main, ".git/hooks"), link);
    expect(file("Write", join(link, "post-commit")).deny).toMatch(/\.git/);
  });

  test("reads of .git and writes to similar names are allowed", () => {
    expect(file("Read", join(main, ".git/config"))).toEqual({});
    expect(file("Write", join(tree, ".github/workflows/ci.yml"))).toEqual({});
    expect(file("Write", join(tree, ".gitignore"))).toEqual({});
    expect(file("Write", join(tree, ".gitattributes"))).toEqual({});
    expect(file("Write", join(tree, "docs/git/notes.md"))).toEqual({});
  });
});

describe("shell writes", () => {
  test.each([
    "echo x > .git/hooks/pre-commit",
    "echo x >> .git/config",
    "tee .git/info/exclude",
    "cp evil.sh .git/hooks/pre-commit",
    "mv evil .git/hooks/post-merge",
    "rm -rf .git/hooks",
    "rm -rf .git",
    "sed -i s/a/b/ .git/config",
    "dd if=x of=.git/config",
    "install evil .git/hooks/pre-push",
    "echo sha > /tmp/somewhere/heat-verified",
    "echo sha > docs/heat-verified",
    "cd .git && echo x > hooks/pre-commit",
  ])("denies %s", (command) => {
    expect(bash(command).deny, command).toMatch(/\.git|heat-verified/);
  });

  test("denies writes reached through an absolute path to the common directory", () => {
    expect(bash(`echo x > ${join(main, ".git/hooks/pre-commit")}`).deny).toMatch(/\.git/);
    expect(bash(`echo x > ${join(gitDir, "heat-verified")}`).deny).toMatch(/heat-verified|\.git/);
  });

  test.each([
    "cat .git/config",
    "head -n 3 .git/HEAD",
    "ls .git/hooks",
    "git commit -m 'docs: x (#60)'",
    "git add -A",
    "git worktree add -b chore/61-x ../other origin/main",
    "git branch feature",
    "git checkout -b chore/62-y",
    "git config user.name tester",
    "git fetch origin",
    "git push -u origin chore/60-gitdir",
    "git stash",
    "git rebase --continue",
    "echo ok > .gitignore",
    "echo ok > .github/CODEOWNERS",
  ])("allows %s", (command) => {
    expect(bash(command)).toEqual({});
  });
});

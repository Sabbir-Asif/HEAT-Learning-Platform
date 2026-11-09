import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { dangerGuard } from "../../src/hooks/danger-guard.mjs";
import { addWorktree, cleanupAll, git, makeRepo, tempDir } from "../fixtures/repo.mjs";

afterAll(cleanupAll);

let main;
let tree;
let gitDir;

beforeAll(() => {
  main = makeRepo({ branch: "epic/e0-x" });
  tree = addWorktree(main, "chore/60-gitdir");
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

describe("local settings", () => {
  test("Write, Edit and shell writes to .claude/settings.local.json are denied", () => {
    const local = join(tree, ".claude/settings.local.json");
    for (const tool of ["Write", "Edit", "MultiEdit"]) {
      expect(file(tool, local).deny, tool).toMatch(/settings\.local\.json/);
    }
    expect(bash("echo '{}' > .claude/settings.local.json").deny).toMatch(/settings\.local\.json/);
    expect(bash("cp x .claude/settings.local.json").deny).toMatch(/settings\.local\.json/);
  });

  test("the checked-in settings file and reads of the local one are not touched here", () => {
    expect(file("Write", join(tree, ".claude/settings.json"))).toEqual({});
    expect(file("Read", join(tree, ".claude/settings.local.json"))).toEqual({});
    expect(bash("cat .claude/settings.local.json")).toEqual({});
  });
});

describe("git config keys that run commands", () => {
  test.each([
    "git config core.hooksPath .githooks",
    "git config --local core.hooksPath /tmp/hooks",
    "git config --worktree core.hooksPath /tmp/hooks",
    "git config --global core.hooksPath /tmp/hooks",
    "git config core.hookspath x",
    "git config core.fsmonitor 'sh -c evil'",
    "git config core.sshCommand 'ssh -o ProxyCommand=evil'",
    "git config core.editor evil",
    "git config core.pager evil",
    "git config alias.p 'push --force'",
    "git config --add alias.x '!evil'",
    "git config --replace-all core.hooksPath x",
    "git config --unset core.hooksPath",
    "git config --unset-all alias.p",
    "git config credential.helper '!evil'",
    "git config filter.lfs.smudge evil",
    "git config diff.external evil",
    "git config diff.x.textconv evil",
    "git config include.path ../evil",
    "git config includeIf.gitdir:/.path ../evil",
    "git config url.git@evil:.insteadOf https://github.com/",
    "git config --file .git/config core.hooksPath x",
    "git -C ../other config core.hooksPath x",
    "cd .. && git config alias.p x",
    "git config -- core.hooksPath x",
  ])("denies %s", (command) => {
    expect(bash(command).deny, command).toMatch(/git config/);
  });

  test.each([
    "git config user.name tester",
    "git config user.email tester@example.com",
    "git config --get core.hooksPath",
    "git config core.hooksPath",
    "git config alias.p",
    "git config --list",
    "git config -l",
    "git config --get-regexp alias",
    "git config --get-all remote.origin.url",
    "git config --local --get core.editor",
    "git config commit.gpgsign false",
    "git config --unset user.name",
    "git config pull.rebase true",
    "git config --global init.defaultBranch main",
    "git -c core.hooksPath=/dev/null commit -m x",
  ])("allows %s", (command) => {
    expect(bash(command), command).toEqual({});
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

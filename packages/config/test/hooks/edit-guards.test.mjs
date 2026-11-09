import { mkdirSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { branchDenial, branchGuard, locate, targetOf } from "../../src/hooks/edit-guards.mjs";
import { addWorktree, cleanupAll, git, makeRepo, tempDir, write } from "../fixtures/repo.mjs";

afterAll(cleanupAll);

const edit = (file, extra = {}) => ({
  tool_name: "Write",
  tool_input: { file_path: file },
  ...extra,
});

describe("targetOf", () => {
  test("reads file_path and notebook_path and throws without either", () => {
    expect(targetOf({ tool_input: { file_path: "/a" } })).toBe("/a");
    expect(targetOf({ tool_input: { notebook_path: "/n.ipynb" } })).toBe("/n.ipynb");
    expect(() => targetOf({ tool_input: {} })).toThrow(/path/);
    expect(() => targetOf({})).toThrow(/path/);
  });
});

describe("branch guard", () => {
  test.each(["main", "master"])(
    "blocks an edit in a checkout on %s and names the branch",
    (name) => {
      const repo = makeRepo({ branch: name });
      const result = branchGuard(edit(join(repo, "src/a.ts")));
      expect(result.deny).toContain(`"${name}"`);
      expect(result.deny).toMatch(/stage 3/);
    },
  );

  test("blocks a detached HEAD with its own message", () => {
    const repo = makeRepo();
    git(repo, "checkout", "-q", "--detach");
    const denied = branchGuard(edit(join(repo, "a.ts"))).deny;
    expect(denied).toMatch(/detached HEAD/);
    expect(denied).toMatch(/git switch/);
    expect(denied).not.toMatch(/on "main"/);
  });

  test.each(["rebase-merge", "rebase-apply"])(
    "allows a detached HEAD while %s is in progress",
    (directory) => {
      const repo = makeRepo();
      git(repo, "checkout", "-q", "--detach");
      const gitDir = git(repo, "rev-parse", "--absolute-git-dir");
      mkdirSync(join(gitDir, directory));
      expect(branchGuard(edit(join(repo, "a.ts")))).toEqual({});
      rmSync(join(gitDir, directory), { recursive: true });
      expect(branchGuard(edit(join(repo, "a.ts"))).deny).toBeTruthy();
    },
  );

  test("a rebase in progress in a worktree is found in that worktree's own git directory", () => {
    const tree = addWorktree(makeRepo(), "chore/70-rebase");
    git(tree, "checkout", "-q", "--detach");
    mkdirSync(join(git(tree, "rev-parse", "--absolute-git-dir"), "rebase-merge"));
    expect(branchGuard(edit(join(tree, "a.ts")))).toEqual({});
  });

  test("blocks a file that does not exist yet in a directory that does not exist yet", () => {
    const repo = makeRepo();
    expect(branchGuard(edit(join(repo, "new/deep/a.ts"))).deny).toBeTruthy();
  });

  test("allows a file in a worktree on a feature branch whatever the session cwd is", () => {
    const repo = makeRepo();
    const tree = addWorktree(repo, "chore/5-x");
    expect(branchGuard(edit(join(tree, "a.ts"), { cwd: repo }))).toEqual({});
  });

  test("a session cwd on a feature branch does not excuse a file on main", () => {
    const repo = makeRepo();
    const tree = addWorktree(repo, "chore/5-x");
    expect(branchGuard(edit(join(repo, "a.ts"), { cwd: tree })).deny).toBeTruthy();
  });

  test("allows epic branches", () => {
    expect(branchGuard(edit(join(makeRepo({ branch: "epic/e0-x" }), "a.ts")))).toEqual({});
  });

  test("never blocks a path outside any repository", () => {
    expect(branchGuard(edit(join(tempDir("scratch"), "notes.md")))).toEqual({});
    expect(branchGuard(edit(join(tempDir("scratch"), "no/such/dir/notes.md")))).toEqual({});
  });

  test("resolves a symlink into main", () => {
    const repo = makeRepo();
    const elsewhere = tempDir("links");
    symlinkSync(repo, join(elsewhere, "link"));
    expect(branchGuard(edit(join(elsewhere, "link/a.ts"))).deny).toBeTruthy();
  });

  test("blocks a notebook edit through notebook_path", () => {
    const repo = makeRepo();
    const input = {
      tool_name: "NotebookEdit",
      tool_input: { notebook_path: join(repo, "n.ipynb") },
    };
    expect(branchGuard(input).deny).toBeTruthy();
  });

  test("branchDenial and locate are usable on their own", () => {
    const repo = makeRepo();
    const location = locate(join(repo, "a/b.ts"), "/");
    expect(location).toMatchObject({ top: repo, relative: "a/b.ts", branch: "main" });
    expect(branchDenial(location)).toMatch(/main/);
    expect(locate(join(tempDir("x"), "a"), "/")).toBeNull();
  });
});

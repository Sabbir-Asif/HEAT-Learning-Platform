import { afterAll, expect, test } from "vitest";
import { branchOf, existsInBase, repoOf, ticketNumber, worktreeFor } from "../../src/hooks/git.mjs";
import {
  addOrigin,
  addWorktree,
  cleanupAll,
  commitAll,
  git,
  makeRepo,
  tempDir,
  write,
} from "../fixtures/repo.mjs";

afterAll(cleanupAll);

test("repoOf finds the top level of the file's own repository, existing or not", () => {
  const repo = makeRepo();
  expect(repoOf(`${repo}/new/dir/file.ts`)).toBe(repo);
  expect(repoOf(repo)).toBe(repo);
});

test("repoOf is null outside any repository", () => {
  expect(repoOf(`${tempDir("plain")}/file.ts`)).toBeNull();
});

test("repoOf tells a worktree from the checkout it was made from", () => {
  const repo = makeRepo();
  const tree = addWorktree(repo, "chore/1-x");
  expect(repoOf(`${tree}/a.ts`)).toBe(tree);
  expect(branchOf(tree)).toBe("chore/1-x");
  expect(branchOf(repo)).toBe("main");
});

test("branchOf is empty on a detached HEAD", () => {
  const repo = makeRepo();
  git(repo, "checkout", "-q", "--detach");
  expect(branchOf(repo)).toBe("");
});

test("branchOf throws when git cannot answer", () => {
  expect(() => branchOf(tempDir("plain"))).toThrow(/git/);
});

test.each([
  ["chore/25-workflow-hooks", 25],
  ["feat/7-x", 7],
  ["spike/100-a-b", 100],
  ["epic/e0-foundation", null],
  ["main", null],
  ["feature/3-x", null],
  ["chore/x-25", null],
])("ticketNumber(%s) is %s", (branch, expected) => {
  expect(ticketNumber(branch)).toBe(expected);
});

test("worktreeFor maps a branch to the worktree that has it checked out", () => {
  const repo = makeRepo();
  const tree = addWorktree(repo, "chore/9-y");
  expect(worktreeFor(repo, "chore/9-y")).toBe(tree);
  expect(worktreeFor(repo, "chore/404-none")).toBeNull();
});

test("existsInBase sees files and directories present in origin/main or origin/epic/*", () => {
  const repo = makeRepo({ files: { "apps/api/prisma/migrations/001_init/migration.sql": "a\n" } });
  addOrigin(repo, ["main", "epic/e1-x"]);
  write(repo, "apps/api/prisma/migrations/002_new/migration.sql", "b\n");
  commitAll(repo);
  expect(existsInBase(repo, "apps/api/prisma/migrations/001_init/migration.sql")).toBe(true);
  expect(existsInBase(repo, "apps/api/prisma/migrations/001_init")).toBe(true);
  expect(existsInBase(repo, "apps/api/prisma/migrations/002_new/migration.sql")).toBe(false);
});

test("existsInBase is false without an origin", () => {
  expect(existsInBase(makeRepo(), "README.md")).toBe(false);
});

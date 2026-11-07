import { spawnSync } from "node:child_process";
import { afterAll, expect, test } from "vitest";
import {
  branchOf,
  existsInBase,
  git as run,
  repoOf,
  ticketNumber,
  worktreeFor,
} from "../../src/hooks/git.mjs";
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

function importTree(repo, ref, paths) {
  const lines = [
    "commit " + ref,
    "committer t <t@example.com> 1700000000 +0000",
    "data 5",
    "bulk",
    "",
  ];
  for (const path of paths) lines.push(`M 100644 inline ${path}`, "data 2", "x", "");
  const result = spawnSync("git", ["fast-import", "--quiet"], {
    cwd: repo,
    input: lines.join("\n"),
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(result.stderr);
}

test("existsInBase still finds a migration when the base tree is far larger than a pipe buffer", () => {
  const repo = makeRepo();
  const migration = "apps/api/prisma/migrations/001_init/migration.sql";
  const paths = Array.from(
    { length: 40000 },
    (_, index) =>
      `packages/generated/modules/group-${index % 200}/component-with-a-long-name-${index}.ts`,
  );
  importTree(repo, "refs/remotes/origin/main", [...paths, migration]);
  const listing = spawnSync("git", ["ls-tree", "-r", "--name-only", "refs/remotes/origin/main"], {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  expect(listing.stdout.length).toBeGreaterThan(2 * 1024 * 1024);
  expect(existsInBase(repo, migration)).toBe(true);
  expect(existsInBase(repo, "apps/api/prisma/migrations/002_new/migration.sql")).toBe(false);
  expect(existsInBase(repo, "APPS/API/PRISMA/MIGRATIONS/001_INIT")).toBe(true);
}, 60000);

test("existsInBase fails closed when git cannot list the base", () => {
  const repo = makeRepo();
  addOrigin(repo, ["main"]);
  const broken = (top, args) => (args[0] === "ls-tree" ? null : run(top, args));
  expect(existsInBase(repo, "apps/api/prisma/migrations/002_new/migration.sql", broken)).toBe(true);
  const noRefs = () => null;
  expect(existsInBase(repo, "apps/api/prisma/migrations/002_new/migration.sql", noRefs)).toBe(true);
});

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const identity = {
  GIT_AUTHOR_NAME: "tester",
  GIT_AUTHOR_EMAIL: "tester@example.com",
  GIT_COMMITTER_NAME: "tester",
  GIT_COMMITTER_EMAIL: "tester@example.com",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
};

const created = [];

export function git(cwd, ...args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...identity },
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function tempDir(label) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), `heat-hooks-${label}-`)));
  created.push(dir);
  return dir;
}

export function cleanupAll() {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
}

export function write(root, relative, content = "x\n") {
  const path = join(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  return path;
}

export function commitAll(dir, message = "change") {
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", message);
  return git(dir, "rev-parse", "HEAD");
}

export function makeRepo({ branch = "main", files = {} } = {}) {
  const dir = tempDir("repo");
  git(dir, "init", "-q", "-b", branch);
  write(dir, "README.md", "readme\n");
  for (const [relative, content] of Object.entries(files)) write(dir, relative, content);
  commitAll(dir, "init");
  return dir;
}

export function addOrigin(repo, branches = ["main"]) {
  const bare = tempDir("origin");
  git(bare, "init", "--bare", "-q");
  git(repo, "remote", "add", "origin", bare);
  for (const name of branches) git(repo, "push", "-q", "origin", `HEAD:refs/heads/${name}`);
  git(repo, "fetch", "-q", "origin");
  return bare;
}

export function addWorktree(repo, branch, base = "HEAD") {
  const path = join(tempDir("wt"), "tree");
  git(repo, "worktree", "add", "-q", "-b", branch, path, base);
  return realpathSync(path);
}

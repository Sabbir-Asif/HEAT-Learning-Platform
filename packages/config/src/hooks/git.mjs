import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { resolveReal } from "./paths.mjs";

const gitTimeout = 10000;
const ticketBranch = /^(?:feat|fix|chore|docs|spike)\/(\d+)-/;

function cleanEnv() {
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: "0" };
  for (const name of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR"]) {
    delete env[name];
  }
  return env;
}

export function git(cwd, args) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      env: cleanEnv(),
      stdio: ["ignore", "pipe", "ignore"],
      timeout: gitTimeout,
    }).trim();
  } catch {
    return null;
  }
}

export function nearestDirectory(path) {
  let current = path;
  while (!(existsSync(current) && statSync(current).isDirectory())) {
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return current;
}

export function repoOf(path) {
  const top = git(nearestDirectory(resolveReal(path)), ["rev-parse", "--show-toplevel"]);
  return top ? resolveReal(top) : null;
}

export function branchOf(top) {
  const branch = git(top, ["branch", "--show-current"]);
  if (branch === null) throw new Error(`git could not read the branch of ${top}`);
  return branch;
}

export function ticketNumber(branch) {
  const match = ticketBranch.exec(branch);
  return match ? Number(match[1]) : null;
}

export function worktreesOf(cwd) {
  const listing = git(nearestDirectory(resolveReal(cwd)), ["worktree", "list", "--porcelain"]);
  if (!listing) return [];
  return listing
    .split("\n\n")
    .map((block) => {
      const field = (name) => block.match(new RegExp(`^${name} (.+)$`, "m"))?.[1] ?? null;
      const path = field("worktree");
      return {
        path: path ? resolveReal(path) : null,
        branch: field("branch")?.replace(/^refs\/heads\//, "") ?? null,
      };
    })
    .filter((tree) => tree.path);
}

export function worktreeFor(cwd, branch) {
  return worktreesOf(cwd).find((tree) => tree.branch === branch)?.path ?? null;
}

export function existsInBase(top, relativePath) {
  const refs = git(top, [
    "for-each-ref",
    "--format=%(refname)",
    "refs/remotes/origin/main",
    "refs/remotes/origin/epic",
  ]);
  const wanted = relativePath.toLowerCase().replace(/\/+$/, "");
  return (refs ? refs.split("\n") : []).some((ref) =>
    (git(top, ["ls-tree", "-r", "--name-only", ref]) ?? "").split("\n").some((name) => {
      const lower = name.toLowerCase();
      return lower === wanted || lower.startsWith(`${wanted}/`);
    }),
  );
}

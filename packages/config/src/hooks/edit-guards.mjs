import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { branchOf, git, repoOf } from "./git.mjs";
import { resolveReal } from "./paths.mjs";

const protectedBranches = new Set(["main", "master", ""]);

export function targetOf(input) {
  const toolInput = input.tool_input ?? {};
  const target = toolInput.file_path ?? toolInput.notebook_path;
  if (typeof target !== "string" || !target) throw new Error("tool_input has no file path");
  return target;
}

export function locate(target, cwd) {
  const real = resolveReal(target, cwd || process.cwd());
  const top = repoOf(real);
  if (!top) return null;
  return { real, top, relative: relative(top, real), branch: branchOf(top) };
}

function rebaseInProgress(top) {
  const gitDir = git(top, ["rev-parse", "--absolute-git-dir"]);
  return (
    Boolean(gitDir) &&
    ["rebase-merge", "rebase-apply"].some((name) => existsSync(join(gitDir, name)))
  );
}

export function branchDenial(location) {
  if (!protectedBranches.has(location.branch)) return null;
  if (location.branch === "") {
    if (rebaseInProgress(location.top)) return null;
    return `Edits are blocked: ${location.real} is in a checkout with a detached HEAD, not on a branch. Check out the ticket branch (git switch <branch>) or create it in its own worktree (stage 3 of /implement-issue).`;
  }
  return `Edits are blocked: ${location.real} is in a checkout on "${location.branch}". Create the ticket branch and worktree first (stage 3 of /implement-issue) and work there.`;
}

export function branchGuard(input) {
  const location = locate(targetOf(input), input.cwd);
  if (!location) return {};
  const deny = branchDenial(location);
  return deny ? { deny } : {};
}

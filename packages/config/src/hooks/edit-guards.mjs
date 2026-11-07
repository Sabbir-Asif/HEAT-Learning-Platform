import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { branchOf, repoOf, ticketNumber } from "./git.mjs";
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

export function branchDenial(location) {
  if (!protectedBranches.has(location.branch)) return null;
  const name = location.branch ? `"${location.branch}"` : "a detached HEAD";
  return `Edits are blocked: ${location.real} is in a checkout on ${name}. Create the ticket branch and worktree first (stage 3 of /implement-issue) and work there.`;
}

export function planPath(location, number) {
  return join(location.top, "docs", "plans", `issue-${number}.md`);
}

export function planDenial(location) {
  const number = ticketNumber(location.branch);
  if (number === null) return null;
  if (location.real === planPath(location, number)) return null;
  if (existsSync(planPath(location, number))) return null;
  return `Source edits are blocked on ${location.branch} until docs/plans/issue-${number}.md exists in ${location.top} (stage 4 of /implement-issue). Write and commit the plan first; the plan file itself can be edited.`;
}

export function branchGuard(input) {
  const location = locate(targetOf(input), input.cwd);
  if (!location) return {};
  const deny = branchDenial(location);
  return deny ? { deny } : {};
}

export function planGate(input) {
  const location = locate(targetOf(input), input.cwd);
  if (!location || protectedBranches.has(location.branch)) return {};
  if (ticketNumber(location.branch) === null) {
    return {
      context: `Plan gate: branch "${location.branch}" is not a <type>/N-slug ticket branch, so no plan is required for this edit.`,
    };
  }
  const deny = planDenial(location);
  return deny ? { deny } : {};
}

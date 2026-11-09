import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { git } from "./git.mjs";
import { readState, updateState } from "./state.mjs";

const maxBlocks = 3;
const typecheckTimeout = 100000;
const tailLines = 40;
const tailCharacters = 3000;
const testFile = /(?:^|\/)test\/|\.(?:test|spec)\.[cm]?[jt]sx?$/;

export function runTypecheck(cwd) {
  try {
    execFileSync("pnpm", ["typecheck"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: typecheckTimeout,
      maxBuffer: 32 * 1024 * 1024,
    });
    return { status: "ok", output: "" };
  } catch (error) {
    if (error.code === "ENOENT") return { status: "missing", output: "" };
    if (error.code === "ETIMEDOUT" || error.killed) return { status: "timeout", output: "" };
    return { status: "failed", output: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
}

function changedPaths(worktree) {
  const status = git(worktree, ["status", "--porcelain", "-uall"]) ?? "";
  return status
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3).split(" -> ").pop());
}

function shouldSkip(worktree) {
  const changed = changedPaths(worktree);
  return changed.length > 0 && changed.every((path) => testFile.test(path));
}

function tail(output) {
  return output.trim().split("\n").slice(-tailLines).join("\n").slice(-tailCharacters);
}

export function stopCheck(input, { env = process.env, exec = runTypecheck } = {}) {
  if (input.stop_hook_active) return {};
  const state = readState(input.session_id, env);
  if (!state.typedDirty || !state.worktree || !existsSync(state.worktree)) return {};
  if (state.blocks >= maxBlocks) {
    return {
      context: `Stop check: typecheck has blocked ${maxBlocks} times this session and is not blocking again; fix the type errors before the pull request.`,
    };
  }
  if (shouldSkip(state.worktree)) return {};
  const result = exec(state.worktree);
  if (result.status === "timeout") {
    return {
      context: "Stop check: typecheck timed out and was skipped; run pnpm typecheck yourself.",
    };
  }
  if (result.status === "missing") {
    return { context: "Stop check: pnpm was not found, so typecheck was skipped." };
  }
  if (result.status === "ok") {
    updateState(input.session_id, { typedDirty: false, blocks: 0 }, env);
    return {};
  }
  const blocks = state.blocks + 1;
  updateState(input.session_id, { blocks }, env);
  return {
    block: `Typecheck failed in ${state.worktree} (block ${blocks} of ${maxBlocks}). Fix these errors before finishing:\n${tail(result.output)}`,
  };
}

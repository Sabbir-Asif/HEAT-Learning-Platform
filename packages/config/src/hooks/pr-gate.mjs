import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { ghInvocation } from "./invocation.mjs";
import { repoOf, worktreeFor } from "./git.mjs";
import { markerStatus } from "./marker.mjs";
import { parseShell } from "./shell.mjs";

const pullsCollection = /^\/?repos\/[^/]+\/[^/]+\/pulls\/?(?:\?.*)?$/;
const maxInputBytes = 1024 * 1024;

function mentionsMutation(file, cwd) {
  if (file === "-") return true;
  const path = resolve(cwd, file);
  if (!existsSync(path) || statSync(path).size > maxInputBytes) return false;
  return readFileSync(path, "utf8").includes("createPullRequest");
}

function isGuarded(invocation) {
  if (invocation.help) return false;
  const [first, second] = invocation.positional;
  if (first === "pr") return second === "create" || second === "new";
  if (first !== "api") return false;
  if (second === "graphql") {
    return (
      invocation.mentionsPullRequestMutation ||
      invocation.files.some((file) => mentionsMutation(file, invocation.cwd))
    );
  }
  if (!pullsCollection.test(second ?? "")) return false;
  if (invocation.method) return invocation.method.toUpperCase() === "POST";
  return invocation.hasFields;
}

function worktreeOf(invocation, anchors) {
  if (!invocation.head)
    return { top: repoOf(invocation.cwd), reason: "is not in a git repository" };
  const branch = invocation.head.includes(":") ? invocation.head.split(":").pop() : invocation.head;
  for (const anchor of anchors) {
    const top = worktreeFor(anchor, branch);
    if (top) return { top };
  }
  return { top: null, reason: `has no worktree with branch "${branch}" checked out` };
}

export function prGate(input, env = process.env) {
  const command = input.tool_input?.command;
  if (typeof command !== "string") throw new Error("Bash input has no command");
  const base = input.cwd || process.cwd();
  for (const parsed of parseShell(command, base)) {
    const invocation = ghInvocation(parsed);
    if (!invocation || !isGuarded(invocation)) continue;
    const anchors = [parsed.cwd, env.CLAUDE_PROJECT_DIR].filter(Boolean);
    const { top, reason } = worktreeOf(invocation, anchors);
    if (!top) {
      return {
        deny: `Pull request blocked: the working directory ${reason}, so its verification marker cannot be found. Run the command from the ticket's worktree.`,
      };
    }
    const status = markerStatus(top);
    if (!status.valid) {
      return {
        deny: `Pull request blocked for ${top}: ${status.reason}. Stage 6 must pass on the current commit before stage 8.`,
      };
    }
  }
  return {};
}

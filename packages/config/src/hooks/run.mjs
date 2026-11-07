import { contextLoader } from "./context-loader.mjs";
import { dangerGuard } from "./danger-guard.mjs";
import { branchGuard, planGate } from "./edit-guards.mjs";
import { formatter } from "./formatter.mjs";
import { ticketInjector } from "./injector.mjs";
import { prGate } from "./pr-gate.mjs";
import { stopCheck } from "./stop-check.mjs";

const specs = {
  "branch-guard": { event: "PreToolUse", closed: true, run: branchGuard },
  "plan-gate": { event: "PreToolUse", closed: true, run: planGate },
  "danger-guard": { event: "PreToolUse", closed: true, run: dangerGuard },
  "pr-gate": { event: "PreToolUse", closed: true, run: prGate },
  "context-loader": { event: "SessionStart", closed: false, run: contextLoader },
  formatter: { event: "PostToolUse", closed: false, run: formatter },
  "ticket-injector": { event: "UserPromptSubmit", closed: false, run: ticketInjector },
  "stop-check": { event: "Stop", closed: false, run: stopCheck },
};

const wrote = (code, stdout = "", stderr = "") => ({ code, stdout, stderr });

function parseInput(raw) {
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("hook input is empty or not valid JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("hook input is not a JSON object");
  }
  return value;
}

function render(event, result) {
  if (result.deny) {
    return {
      hookSpecificOutput: {
        hookEventName: event,
        permissionDecision: "deny",
        permissionDecisionReason: result.deny,
      },
    };
  }
  if (result.block) return { decision: "block", reason: result.block };
  if (result.context) {
    return { hookSpecificOutput: { hookEventName: event, additionalContext: result.context } };
  }
  return null;
}

export async function runHook(name, raw, registry = specs) {
  const spec = registry[name];
  if (!spec) return wrote(1, "", `heat hooks: unknown hook "${name}"`);
  try {
    const output = render(spec.event, (await spec.run(parseInput(raw))) ?? {});
    return wrote(0, output ? JSON.stringify(output) : "");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!spec.closed) return wrote(0, "", `heat hooks: ${name} skipped: ${message}`);
    return wrote(
      0,
      JSON.stringify(render(spec.event, { deny: `${name} failed closed: ${message}` })),
    );
  }
}

export const hookSpecs = specs;

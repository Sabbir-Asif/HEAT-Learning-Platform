#!/usr/bin/env node
import { readFileSync } from "node:fs";

const [name] = process.argv.slice(2);
const guards = new Set(["branch-guard", "danger-guard", "pr-gate"]);

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function denyOutput(message) {
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: message,
    },
  });
}

try {
  const { runHook } = await import("../src/hooks/run.mjs");
  const result = await runHook(name, readStdin());
  if (result.stdout) process.stdout.write(`${result.stdout}\n`);
  if (result.stderr) process.stderr.write(`${result.stderr}\n`);
  process.exitCode = result.code;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (guards.has(name))
    process.stdout.write(`${denyOutput(`${name} failed closed: ${message}`)}\n`);
  else process.stderr.write(`heat hooks: ${name} skipped: ${message}\n`);
}

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

export const hookBin = resolve(import.meta.dirname, "../../bin/hook.mjs");

function parse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function runBin(name, input, { env = {}, bin = hookBin, raw } = {}) {
  const result = spawnSync("node", [bin, name], {
    input: raw ?? JSON.stringify(input),
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return {
    code: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    json: parse(result.stdout),
  };
}

export const decisionOf = (result) => result.json?.hookSpecificOutput?.permissionDecision ?? null;

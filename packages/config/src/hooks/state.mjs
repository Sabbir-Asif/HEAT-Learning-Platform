import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const empty = { worktree: null, typedDirty: false, blocks: 0 };

export const stateDir = (env = process.env) =>
  env.HEAT_HOOKS_STATE_DIR || join(tmpdir(), "heat-hooks");

function fileFor(sessionId, env) {
  const name = String(sessionId ?? "default").replace(/[^A-Za-z0-9_-]/g, "_");
  return join(stateDir(env), `${name}.json`);
}

export function readState(sessionId, env = process.env) {
  try {
    return { ...empty, ...JSON.parse(readFileSync(fileFor(sessionId, env), "utf8")) };
  } catch {
    return { ...empty };
  }
}

export function updateState(sessionId, patch, env = process.env) {
  const next = { ...readState(sessionId, env), ...patch };
  mkdirSync(stateDir(env), { recursive: true, mode: 0o700 });
  writeFileSync(fileFor(sessionId, env), JSON.stringify(next));
  return next;
}

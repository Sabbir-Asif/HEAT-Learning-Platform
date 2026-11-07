import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const empty = { worktree: null, typedDirty: false, blocks: 0 };
const currentUser = () => process.getuid?.() ?? 0;

export const stateDir = (env = process.env) =>
  env.HEAT_HOOKS_STATE_DIR || join(tmpdir(), `heat-hooks-${currentUser()}`);

function verify(dir, owner) {
  const info = lstatSync(dir);
  if (info.isSymbolicLink() || !info.isDirectory()) {
    throw new Error(`${dir} is not a plain directory`);
  }
  if (process.getuid && info.uid !== owner) throw new Error(`${dir} is owned by another user`);
  if ((info.mode & 0o077) !== 0) chmodSync(dir, 0o700);
}

export function ensureStateDir(env = process.env, owner = currentUser()) {
  const dir = stateDir(env);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  verify(dir, owner);
  return dir;
}

function fileFor(sessionId, dir) {
  const name = String(sessionId ?? "default").replace(/[^A-Za-z0-9_-]/g, "_");
  return join(dir, `${name}.json`);
}

export function readState(sessionId, env = process.env) {
  const dir = stateDir(env);
  if (!existsSync(dir)) return { ...empty };
  verify(dir, currentUser());
  try {
    return { ...empty, ...JSON.parse(readFileSync(fileFor(sessionId, dir), "utf8")) };
  } catch {
    return { ...empty };
  }
}

export function updateState(sessionId, patch, env = process.env) {
  const dir = ensureStateDir(env);
  const next = { ...readState(sessionId, env), ...patch };
  writeFileSync(fileFor(sessionId, dir), JSON.stringify(next), { mode: 0o600 });
  return next;
}

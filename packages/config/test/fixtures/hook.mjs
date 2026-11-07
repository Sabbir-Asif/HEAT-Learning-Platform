import { spawnSync } from "node:child_process";
import { chmodSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tempDir } from "./repo.mjs";

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

export function fakeBin(name, body) {
  const dir = tempDir("fakebin");
  const script = join(dir, name);
  writeFileSync(script, `#!/usr/bin/env node\n${body}\n`);
  chmodSync(script, 0o755);
  return dir;
}

export const withPath = (dir) => ({ PATH: `${dir}:${process.env.PATH}` });

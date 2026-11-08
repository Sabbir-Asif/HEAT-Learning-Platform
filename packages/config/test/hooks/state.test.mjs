import { chmodSync, mkdirSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, expect, test } from "vitest";
import { ensureStateDir, readState, stateDir, updateState } from "../../src/hooks/state.mjs";
import { cleanupAll, tempDir } from "../fixtures/repo.mjs";

afterAll(cleanupAll);

test("the state directory is HEAT_HOOKS_STATE_DIR or a folder under the system temp directory", () => {
  expect(stateDir({ HEAT_HOOKS_STATE_DIR: "/x/y" })).toBe("/x/y");
  expect(stateDir({})).toMatch(new RegExp(`heat-hooks-${process.getuid()}$`));
});

test("an unknown session starts with an empty state", () => {
  const env = { HEAT_HOOKS_STATE_DIR: tempDir("state") };
  expect(readState("abc", env)).toEqual({ worktree: null, typedDirty: false, blocks: 0 });
});

test("updates merge into the stored state per session", () => {
  const env = { HEAT_HOOKS_STATE_DIR: join(tempDir("state"), "nested") };
  updateState("abc", { worktree: "/w", typedDirty: true }, env);
  updateState("abc", { blocks: 2 }, env);
  updateState("other", { blocks: 1 }, env);
  expect(readState("abc", env)).toEqual({ worktree: "/w", typedDirty: true, blocks: 2 });
  expect(readState("other", env).blocks).toBe(1);
  expect(statSync(env.HEAT_HOOKS_STATE_DIR).mode & 0o777).toBe(0o700);
});

test("session ids cannot escape the directory, and a missing id shares one default slot", () => {
  const env = { HEAT_HOOKS_STATE_DIR: tempDir("state") };
  updateState("../../evil", { blocks: 5 }, env);
  expect(readState("../../evil", env).blocks).toBe(5);
  updateState(undefined, { blocks: 1 }, env);
  expect(readState(undefined, env).blocks).toBe(1);
});

test("a corrupt state file reads as empty", () => {
  const env = { HEAT_HOOKS_STATE_DIR: tempDir("state") };
  updateState("abc", { blocks: 1 }, env);
  writeFileSync(join(env.HEAT_HOOKS_STATE_DIR, "abc.json"), "{not json");
  expect(readState("abc", env).blocks).toBe(0);
});

test("the default directory is per user, so another account's directory is never shared", () => {
  expect(stateDir({})).not.toBe(stateDir({ HEAT_HOOKS_STATE_DIR: "/x" }));
  expect(stateDir({})).toContain(String(process.getuid()));
});

test("a directory owned by someone else is refused", () => {
  const env = { HEAT_HOOKS_STATE_DIR: tempDir("state") };
  expect(() => ensureStateDir(env, process.getuid() + 1)).toThrow(/owned by another user/);
});

test("a symlink in place of the directory is refused", () => {
  const real = tempDir("real");
  const link = join(tempDir("links"), "state");
  symlinkSync(real, link);
  expect(() => ensureStateDir({ HEAT_HOOKS_STATE_DIR: link })).toThrow(/plain directory/);
  expect(() => updateState("abc", { blocks: 1 }, { HEAT_HOOKS_STATE_DIR: link })).toThrow();
  expect(() => readState("abc", { HEAT_HOOKS_STATE_DIR: link })).toThrow();
});

test("a plain file in place of the directory is refused", () => {
  const dir = tempDir("files");
  const file = join(dir, "state");
  writeFileSync(file, "x");
  expect(() => ensureStateDir({ HEAT_HOOKS_STATE_DIR: file })).toThrow();
});

test("an existing directory that others can read is tightened to 0700", () => {
  const dir = tempDir("loose");
  chmodSync(dir, 0o755);
  updateState("abc", { blocks: 1 }, { HEAT_HOOKS_STATE_DIR: dir });
  expect(statSync(dir).mode & 0o777).toBe(0o700);
});

test("a missing directory reads as empty without being created", () => {
  const env = { HEAT_HOOKS_STATE_DIR: join(tempDir("none"), "absent") };
  expect(readState("abc", env).blocks).toBe(0);
  expect(() => statSync(env.HEAT_HOOKS_STATE_DIR)).toThrow();
  mkdirSync(env.HEAT_HOOKS_STATE_DIR, { mode: 0o700 });
  expect(readState("abc", env).blocks).toBe(0);
});

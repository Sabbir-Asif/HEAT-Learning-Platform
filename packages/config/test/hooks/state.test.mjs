import { statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, expect, test } from "vitest";
import { readState, stateDir, updateState } from "../../src/hooks/state.mjs";
import { cleanupAll, tempDir } from "../fixtures/repo.mjs";

afterAll(cleanupAll);

test("the state directory is HEAT_HOOKS_STATE_DIR or a folder under the system temp directory", () => {
  expect(stateDir({ HEAT_HOOKS_STATE_DIR: "/x/y" })).toBe("/x/y");
  expect(stateDir({})).toMatch(/heat-hooks$/);
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

test("a corrupt state file reads as empty", async () => {
  const env = { HEAT_HOOKS_STATE_DIR: tempDir("state") };
  updateState("abc", { blocks: 1 }, env);
  const { writeFileSync } = await import("node:fs");
  writeFileSync(join(env.HEAT_HOOKS_STATE_DIR, "abc.json"), "{not json");
  expect(readState("abc", env).blocks).toBe(0);
});

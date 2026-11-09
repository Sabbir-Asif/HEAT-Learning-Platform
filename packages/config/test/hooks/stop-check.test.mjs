import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { readState, updateState } from "../../src/hooks/state.mjs";
import { runTypecheck, stopCheck } from "../../src/hooks/stop-check.mjs";
import { fakeBin } from "../fixtures/hook.mjs";
import {
  addWorktree,
  cleanupAll,
  commitAll,
  git,
  makeRepo,
  tempDir,
  write,
} from "../fixtures/repo.mjs";

afterAll(cleanupAll);

let env;
let tree;
let calls;
let outcome;

const exec = (cwd) => {
  calls.push(cwd);
  return outcome;
};
const stop = (extra = {}) => stopCheck({ session_id: "s1", ...extra }, { env, exec });

beforeEach(() => {
  env = { HEAT_HOOKS_STATE_DIR: tempDir("state") };
  tree = addWorktree(makeRepo(), "chore/40-stop");
  calls = [];
  outcome = { status: "ok", output: "" };
  updateState("s1", { worktree: tree, typedDirty: true, blocks: 0 }, env);
});

describe("when typecheck fails", () => {
  beforeEach(() => {
    outcome = { status: "failed", output: "src/a.ts(1,1): error TS2322: bad\n" };
  });

  test("it blocks with the errors and counts the block", () => {
    write(tree, "src/a.ts");
    const result = stop();
    expect(result.block).toContain("error TS2322");
    expect(result.block).toMatch(/1 of 3/);
    expect(readState("s1", env).blocks).toBe(1);
    expect(calls).toEqual([tree]);
  });

  test("it does not block again while stop_hook_active is set, and does not even run", () => {
    write(tree, "src/a.ts");
    expect(stop({ stop_hook_active: true })).toEqual({});
    expect(calls).toEqual([]);
    expect(readState("s1", env).blocks).toBe(0);
  });

  test("it stops blocking after three blocks, saying so", () => {
    write(tree, "src/a.ts");
    for (const count of [1, 2, 3]) {
      expect(stop().block).toMatch(new RegExp(`${count} of 3`));
    }
    const fourth = stop();
    expect(fourth.block).toBeUndefined();
    expect(fourth.context).toMatch(/3 times/);
    expect(calls).toHaveLength(3);
  });

  test("it keeps only the tail of very long output", () => {
    write(tree, "src/a.ts");
    outcome = {
      status: "failed",
      output: Array.from({ length: 500 }, (_, i) => `line ${i}`).join("\n"),
    };
    const reason = stop().block;
    expect(reason).toContain("line 499");
    expect(reason).not.toContain("line 10\n");
  });
});

describe("when typecheck passes", () => {
  test("it allows the stop, clears the dirty flag and resets the counter", () => {
    write(tree, "src/a.ts");
    updateState("s1", { blocks: 2 }, env);
    expect(stop()).toEqual({});
    expect(readState("s1", env)).toMatchObject({ typedDirty: false, blocks: 0 });
  });
});

describe("skips", () => {
  test("when nothing typed was edited", () => {
    updateState("s1", { typedDirty: false }, env);
    write(tree, "src/a.ts");
    expect(stop()).toEqual({});
    expect(calls).toEqual([]);
  });

  test("when no worktree was recorded or it is gone", () => {
    updateState("s1", { worktree: null }, env);
    expect(stop()).toEqual({});
    updateState("s1", { worktree: "/no/such/dir" }, env);
    expect(stop()).toEqual({});
    expect(calls).toEqual([]);
  });

  test("during the failing-test step: only test files changed", () => {
    write(tree, "packages/config/test/hooks/a.test.mjs");
    write(tree, "src/b.test.ts");
    write(tree, "test/fixtures/c.ts");
    expect(stop()).toEqual({});
    expect(calls).toEqual([]);
  });

  test("a source file next to test files still runs the check", () => {
    write(tree, "test/a.test.ts");
    write(tree, "src/real.ts");
    stop();
    expect(calls).toEqual([tree]);
  });

  test("a clean tree still runs the check", () => {
    write(tree, "src/a.ts");
    commitAll(tree);
    stop();
    expect(calls).toEqual([tree]);
  });

  test("a rename is judged by its new path", () => {
    write(tree, "src/old.ts");
    commitAll(tree);
    updateState("s1", { typedDirty: true }, env);
    git(tree, "mv", "src/old.ts", "src/old.test.ts");
    expect(stop()).toEqual({});
    expect(calls).toEqual([]);
  });
});

describe("failing open", () => {
  test("a timeout allows the stop and says so", () => {
    write(tree, "src/a.ts");
    outcome = { status: "timeout", output: "" };
    const result = stop();
    expect(result.block).toBeUndefined();
    expect(result.context).toMatch(/timed out/);
    expect(readState("s1", env).blocks).toBe(0);
  });

  test("a missing pnpm allows the stop and says so", () => {
    write(tree, "src/a.ts");
    outcome = { status: "missing", output: "" };
    expect(stop().context).toMatch(/pnpm/);
  });
});

describe("runTypecheck", () => {
  const withFakePnpm = (body, check) => {
    const original = process.env.PATH;
    process.env.PATH = `${fakeBin("pnpm", body)}:${original}`;
    try {
      return check();
    } finally {
      process.env.PATH = original;
    }
  };

  test("passes when pnpm typecheck exits 0", () => {
    expect(withFakePnpm("process.exit(0);", () => runTypecheck(tree))).toEqual({
      status: "ok",
      output: "",
    });
  });

  test("returns the output when it exits non-zero", () => {
    const result = withFakePnpm('console.log("TS2322 here"); process.exit(2);', () =>
      runTypecheck(tree),
    );
    expect(result.status).toBe("failed");
    expect(result.output).toContain("TS2322 here");
  });

  test("reports a missing pnpm", () => {
    const original = process.env.PATH;
    process.env.PATH = tempDir("empty");
    try {
      expect(runTypecheck(tree).status).toBe("missing");
    } finally {
      process.env.PATH = original;
    }
  });
});

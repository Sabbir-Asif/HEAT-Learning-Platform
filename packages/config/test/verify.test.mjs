import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, describe, expect, test } from "vitest";
import { markerStatus } from "../src/hooks/marker.mjs";
import { runVerify, steps } from "../src/verify.mjs";
import { addWorktree, cleanupAll, commitAll, makeRepo, tempDir, write } from "./fixtures/repo.mjs";

afterAll(cleanupAll);

const names = steps.map((step) => step.join(" "));

describe("runVerify", () => {
  test("runs the five checks in order and writes the marker when all pass", () => {
    const repo = makeRepo();
    const ran = [];
    const result = runVerify({ cwd: repo, run: (step) => (ran.push(step.join(" ")), 0) });
    expect(ran).toEqual(names);
    expect(names).toEqual([
      "pnpm lint",
      "pnpm format:check",
      "pnpm typecheck",
      "pnpm test:coverage",
      "pnpm build",
    ]);
    expect(result).toEqual({ ok: true });
    expect(markerStatus(repo).valid).toBe(true);
  });

  test("stops at the first failure and writes no marker", () => {
    const repo = makeRepo();
    const ran = [];
    const result = runVerify({
      cwd: repo,
      run: (step) => (ran.push(step.join(" ")), step[1] === "typecheck" ? 1 : 0),
    });
    expect(ran).toEqual(names.slice(0, 3));
    expect(result).toEqual({ ok: false, reason: "pnpm typecheck failed" });
    expect(markerStatus(repo).valid).toBe(false);
  });

  test("refuses a dirty tree without running anything", () => {
    const repo = makeRepo();
    write(repo, "dirty.txt");
    const run = () => {
      throw new Error("must not run");
    };
    expect(runVerify({ cwd: repo, run })).toEqual({
      ok: false,
      reason: "the working tree has uncommitted changes; commit them, then run verify again",
    });
  });

  test("does not write the marker when the checks leave the tree changed", () => {
    const repo = makeRepo();
    const result = runVerify({ cwd: repo, run: () => (write(repo, "generated.txt"), 0) });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/changed the working tree/);
    expect(markerStatus(repo).valid).toBe(false);
  });

  test("does not write the marker when HEAD moved during the checks", () => {
    const repo = makeRepo();
    let moved = false;
    const result = runVerify({
      cwd: repo,
      run: () => {
        if (!moved) {
          write(repo, "moved.txt");
          commitAll(repo);
          moved = true;
        }
        return 0;
      },
    });
    expect(result).toEqual({
      ok: false,
      reason: "HEAD moved while the checks ran; run verify again",
    });
  });
});

describe("bin/verify.mjs", () => {
  const bin = join(import.meta.dirname, "../bin/verify.mjs");

  function fakePnpm(failing) {
    const dir = tempDir("fakebin");
    const script = join(dir, "pnpm");
    writeFileSync(
      script,
      `#!/usr/bin/env node\nconsole.log("fake pnpm " + process.argv.slice(2).join(" "));\nprocess.exit(process.argv[2] === ${JSON.stringify(failing)} ? 1 : 0);\n`,
    );
    chmodSync(script, 0o755);
    return dir;
  }

  const run = (cwd, path) =>
    spawnSync("node", [bin], {
      cwd,
      encoding: "utf8",
      env: { ...process.env, PATH: `${path}:${process.env.PATH}` },
    });

  test("exits 0 and reports the marker when everything passes", () => {
    const tree = addWorktree(makeRepo(), "chore/3-x");
    const result = run(tree, fakePnpm(null));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("fake pnpm build");
    expect(result.stdout).toMatch(/verified/i);
    expect(markerStatus(tree).valid).toBe(true);
  });

  test("exits 1 and names the failed step", () => {
    const tree = addWorktree(makeRepo(), "chore/4-x");
    const result = run(tree, fakePnpm("test:coverage"));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("pnpm test:coverage failed");
    expect(markerStatus(tree).valid).toBe(false);
  });

  test("exits 1 outside a git repository", () => {
    const result = run(tempDir("plain"), fakePnpm(null));
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/git repository/);
  });
});

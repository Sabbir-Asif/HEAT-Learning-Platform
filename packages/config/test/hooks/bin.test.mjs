import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { decisionOf, hookBin, runBin } from "../fixtures/hook.mjs";
import { addWorktree, cleanupAll, makeRepo, tempDir, write } from "../fixtures/repo.mjs";

afterAll(cleanupAll);

let main;
let ticket;
let planned;

beforeAll(() => {
  main = makeRepo();
  ticket = addWorktree(main, "chore/25-hooks");
  planned = addWorktree(main, "chore/26-hooks");
  write(planned, "docs/plans/issue-26.md");
});

const write_ = (file) => ({ tool_name: "Write", tool_input: { file_path: file }, cwd: main });
const bash = (command, cwd = ticket) => ({ tool_name: "Bash", tool_input: { command }, cwd });

describe("branch-guard as a child process", () => {
  test("blocks an edit in a checkout on main", () => {
    const result = runBin("branch-guard", write_(join(main, "src/a.ts")));
    expect(result.code).toBe(0);
    expect(decisionOf(result)).toBe("deny");
    expect(result.json.hookSpecificOutput.permissionDecisionReason).toMatch(/"main"/);
  });

  test("allows an edit in a worktree on a feature branch, whatever the session cwd", () => {
    const result = runBin("branch-guard", write_(join(ticket, "src/a.ts")));
    expect(result).toMatchObject({ code: 0, stdout: "" });
  });
});

describe("plan-gate as a child process", () => {
  test("blocks a source edit without the plan", () => {
    const result = runBin("plan-gate", write_(join(ticket, "src/a.ts")));
    expect(decisionOf(result)).toBe("deny");
    expect(result.json.hookSpecificOutput.permissionDecisionReason).toContain("issue-25.md");
  });

  test("allows the plan file, and source edits once the plan exists", () => {
    expect(runBin("plan-gate", write_(join(ticket, "docs/plans/issue-25.md"))).stdout).toBe("");
    expect(runBin("plan-gate", write_(join(planned, "src/a.ts"))).stdout).toBe("");
  });
});

describe("danger-guard as a child process", () => {
  test.each(["git push --force origin x", "pnpm exec prisma migrate reset", "cat apps/api/.env"])(
    "blocks %s",
    (command) => {
      expect(decisionOf(runBin("danger-guard", bash(command)))).toBe("deny");
    },
  );

  test("blocks a Read of an env file and allows .env.example", () => {
    const read = (file) => ({ tool_name: "Read", tool_input: { file_path: file }, cwd: main });
    expect(decisionOf(runBin("danger-guard", read(join(main, ".env"))))).toBe("deny");
    expect(runBin("danger-guard", read(join(main, ".env.example"))).stdout).toBe("");
  });

  test.each([
    "git push -u origin chore/25-hooks",
    "pnpm install --frozen-lockfile",
    "pnpm dev:reset",
  ])("allows %s", (command) => {
    expect(runBin("danger-guard", bash(command, planned))).toMatchObject({ code: 0, stdout: "" });
  });
});

describe("pr-gate as a child process", () => {
  test("blocks gh pr create without a marker", () => {
    const result = runBin("pr-gate", bash("gh pr create --fill", ticket));
    expect(decisionOf(result)).toBe("deny");
    expect(result.json.hookSpecificOutput.permissionDecisionReason).toMatch(/pnpm verify/);
  });

  test("allows other gh commands", () => {
    expect(runBin("pr-gate", bash("gh pr view 3", ticket))).toMatchObject({ code: 0, stdout: "" });
  });
});

describe("failing closed and open", () => {
  test.each(["branch-guard", "plan-gate", "danger-guard", "pr-gate"])(
    "%s denies on empty and malformed input",
    (name) => {
      expect(decisionOf(runBin(name, null, { raw: "" }))).toBe("deny");
      expect(decisionOf(runBin(name, null, { raw: "{{" }))).toBe("deny");
    },
  );

  test("a guard denies when its own modules cannot load", () => {
    const broken = join(tempDir("broken"), "bin");
    mkdirSync(broken, { recursive: true });
    copyFileSync(hookBin, join(broken, "hook.mjs"));
    const denied = runBin("branch-guard", {}, { bin: join(broken, "hook.mjs") });
    expect(decisionOf(denied)).toBe("deny");
    expect(denied.json.hookSpecificOutput.permissionDecisionReason).toMatch(/failed closed/);
    const skipped = runBin("formatter", {}, { bin: join(broken, "hook.mjs") });
    expect(skipped).toMatchObject({ code: 0, stdout: "" });
    expect(skipped.stderr).toMatch(/formatter skipped/);
  });

  test("an unknown hook name exits 1 without blocking anything", () => {
    expect(runBin("nope", {})).toMatchObject({ code: 1, stdout: "" });
  });
});

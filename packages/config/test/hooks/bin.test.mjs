import { copyFileSync, mkdirSync, readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { decisionOf, fakeBin, hookBin, runBin, withPath } from "../fixtures/hook.mjs";
import { updateState } from "../../src/hooks/state.mjs";
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

describe("stop-check as a child process", () => {
  const stateDir = () => ({ HEAT_HOOKS_STATE_DIR: tempDir("state") });

  function seeded(env) {
    updateState("s1", { worktree: ticket, typedDirty: true, blocks: 0 }, env);
    write(ticket, "packages/config/src/stop-fixture.ts");
  }

  test("blocks with the typecheck errors", () => {
    const state = stateDir();
    seeded(state);
    const pnpm = fakeBin("pnpm", 'console.log("src/x.ts: error TS2322"); process.exit(1);');
    const result = runBin(
      "stop-check",
      { session_id: "s1" },
      { env: { ...state, ...withPath(pnpm) } },
    );
    expect(result.code).toBe(0);
    expect(result.json.decision).toBe("block");
    expect(result.json.reason).toContain("error TS2322");
  });

  test("does not block when stop_hook_active is set", () => {
    const state = stateDir();
    seeded(state);
    const pnpm = fakeBin("pnpm", "process.exit(1);");
    const result = runBin(
      "stop-check",
      { session_id: "s1", stop_hook_active: true },
      { env: { ...state, ...withPath(pnpm) } },
    );
    expect(result).toMatchObject({ code: 0, stdout: "" });
  });
});

describe("context-loader as a child process", () => {
  test("prints the ticket context on a ticket branch", () => {
    const result = runBin("context-loader", { cwd: ticket, source: "startup" });
    expect(result.json.hookSpecificOutput.hookEventName).toBe("SessionStart");
    expect(result.json.hookSpecificOutput.additionalContext).toContain("Ticket: #25");
  });

  test("says there is no ticket branch on main", () => {
    const result = runBin("context-loader", { cwd: main, source: "resume" });
    expect(result.json.hookSpecificOutput.additionalContext).toMatch(/no ticket branch/i);
  });
});

describe("ticket-injector as a child process", () => {
  const issue = {
    number: 25,
    title: "T",
    state: "open",
    body: "Build it.",
    author_association: "OWNER",
    user: { login: "o" },
  };
  const comments = [
    {
      user: { login: "o" },
      author_association: "OWNER",
      created_at: "2026-11-08",
      body: "owner note",
    },
    {
      user: { login: "x" },
      author_association: "NONE",
      created_at: "2026-11-08",
      body: "stranger note",
    },
  ];
  const gh = fakeBin(
    "gh",
    `const path = process.argv[3];\nconsole.log(JSON.stringify(path.includes("/comments") ? ${JSON.stringify(comments)} : ${JSON.stringify(issue)}));`,
  );
  const signedOut = fakeBin("gh", 'console.error("gh auth login"); process.exit(4);');
  const env = () => ({ HEAT_HOOKS_STATE_DIR: tempDir("state") });

  test("injects collaborator text for #N and leaves outsiders out", () => {
    const result = runBin(
      "ticket-injector",
      { prompt: "do #25", session_id: "s" },
      { env: { ...env(), ...withPath(gh) } },
    );
    const context = result.json.hookSpecificOutput.additionalContext;
    expect(result.json.hookSpecificOutput.hookEventName).toBe("UserPromptSubmit");
    expect(context).toContain("owner note");
    expect(context).not.toContain("stranger note");
  });

  test("adds a note and never blocks when gh is signed out", () => {
    const result = runBin(
      "ticket-injector",
      { prompt: "do #25", session_id: "s" },
      { env: { ...env(), ...withPath(signedOut) } },
    );
    expect(result.code).toBe(0);
    expect(result.json.decision).toBeUndefined();
    expect(result.json.hookSpecificOutput.additionalContext).toMatch(/could not load #25/);
  });

  test("does nothing for a prompt without #N", () => {
    const result = runBin(
      "ticket-injector",
      { prompt: "/implement-issue 25", session_id: "s" },
      { env: env() },
    );
    expect(result).toMatchObject({ code: 0, stdout: "" });
  });
});

describe("formatter as a child process", () => {
  function project() {
    const repo = addWorktree(main, `chore/6${Math.floor(Math.random() * 1e6)}-fmt`);
    symlinkSync(join(import.meta.dirname, "../../node_modules"), join(repo, "node_modules"));
    write(repo, "package.json", "{}\n");
    write(repo, "pkg/package.json", "{}\n");
    write(repo, "pkg/eslint.config.mjs", 'export default [{ rules: { "no-var": "error" } }];\n');
    return repo;
  }

  const edit = (repo, file, state) =>
    runBin(
      "formatter",
      { tool_name: "Write", tool_input: { file_path: file }, session_id: "f1", cwd: repo },
      { env: state },
    );

  test("fixes and formats the edited file", () => {
    const repo = project();
    const file = write(repo, "pkg/a.js", "var   x = {a:1}\n");
    const result = edit(repo, file, { HEAT_HOOKS_STATE_DIR: tempDir("state") });
    expect(result).toMatchObject({ code: 0, stdout: "" });
    expect(readFileSync(file, "utf8")).toBe("let x = { a: 1 };\n");
  });

  test("records a typed edit for the stop check", () => {
    const repo = project();
    const state = { HEAT_HOOKS_STATE_DIR: tempDir("state") };
    const file = write(repo, "pkg/b.ts", "const   y = {b:2}\n");
    edit(repo, file, state);
    expect(readFileSync(file, "utf8")).toBe("const y = { b: 2 };\n");
    const saved = JSON.parse(readFileSync(join(state.HEAT_HOOKS_STATE_DIR, "f1.json"), "utf8"));
    expect(saved).toMatchObject({ worktree: repo, typedDirty: true });
  });

  test("leaves a file under docs/ alone", () => {
    const repo = project();
    const file = write(repo, "docs/note.md", "*  a\n");
    runBin(
      "formatter",
      { tool_name: "Write", tool_input: { file_path: file }, cwd: repo },
      { env: { HEAT_HOOKS_STATE_DIR: tempDir("state") } },
    );
    expect(readFileSync(file, "utf8")).toBe("*  a\n");
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

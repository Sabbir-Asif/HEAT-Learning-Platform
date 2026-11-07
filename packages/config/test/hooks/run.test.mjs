import { expect, test } from "vitest";
import { runHook } from "../../src/hooks/run.mjs";

const specs = {
  "guard-ok": { event: "PreToolUse", closed: true, run: () => ({}) },
  "guard-deny": { event: "PreToolUse", closed: true, run: () => ({ deny: "no way" }) },
  "guard-note": { event: "PreToolUse", closed: true, run: () => ({ context: "heads up" }) },
  "guard-crash": {
    event: "PreToolUse",
    closed: true,
    run: () => {
      throw new Error("boom");
    },
  },
  "post-crash": {
    event: "PostToolUse",
    closed: false,
    run: () => {
      throw new Error("boom");
    },
  },
  "post-context": { event: "PostToolUse", closed: false, run: () => ({ context: "fixed" }) },
  "stop-block": { event: "Stop", closed: false, run: () => ({ block: "type errors" }) },
  "stop-note": { event: "Stop", closed: false, run: () => ({ context: "skipped" }) },
  "start-note": { event: "SessionStart", closed: false, run: () => ({ context: "hello" }) },
  echo: { event: "PostToolUse", closed: false, run: (input) => ({ context: input.tool_name }) },
};

const call = (name, raw) => runHook(name, raw, specs);
const json = (text) => JSON.parse(text);

test("a guard that finds nothing wrong prints nothing and exits 0", async () => {
  expect(await call("guard-ok", "{}")).toEqual({ code: 0, stdout: "", stderr: "" });
});

test("a PreToolUse deny prints the permission decision JSON and exits 0", async () => {
  const result = await call("guard-deny", "{}");
  expect(result.code).toBe(0);
  expect(json(result.stdout)).toEqual({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "no way",
    },
  });
});

test("a note from a guard is passed as additionalContext, never as an allow decision", async () => {
  const output = json((await call("guard-note", "{}")).stdout);
  expect(output).toEqual({
    hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: "heads up" },
  });
});

test.each(["", "   ", "not json", "[1]", "null"])("a guard denies on input %j", async (raw) => {
  const result = await call("guard-ok", raw);
  expect(json(result.stdout).hookSpecificOutput.permissionDecision).toBe("deny");
  expect(json(result.stdout).hookSpecificOutput.permissionDecisionReason).toMatch(/input/i);
});

test("a guard that crashes denies and says why", async () => {
  const output = json((await call("guard-crash", "{}")).stdout);
  expect(output.hookSpecificOutput.permissionDecision).toBe("deny");
  expect(output.hookSpecificOutput.permissionDecisionReason).toContain("boom");
});

test("a hook that is not a guard fails open with a one-line note", async () => {
  const result = await call("post-crash", "{}");
  expect(result.code).toBe(0);
  expect(result.stdout).toBe("");
  expect(result.stderr).toMatch(/post-crash.*boom/);
  expect(result.stderr.trim().split("\n")).toHaveLength(1);
  expect((await call("post-context", "garbage")).stderr).toMatch(/input/i);
});

test("context goes out as hookSpecificOutput for the hook's event", async () => {
  expect(json((await call("post-context", "{}")).stdout)).toEqual({
    hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: "fixed" },
  });
  expect(json((await call("start-note", "{}")).stdout).hookSpecificOutput.hookEventName).toBe(
    "SessionStart",
  );
});

test("a Stop block uses the top-level decision and reason", async () => {
  expect(json((await call("stop-block", "{}")).stdout)).toEqual({
    decision: "block",
    reason: "type errors",
  });
  expect(json((await call("stop-note", "{}")).stdout).hookSpecificOutput.hookEventName).toBe(
    "Stop",
  );
});

test("the hook receives the parsed input", async () => {
  const output = json((await call("echo", '{"tool_name":"Write"}')).stdout);
  expect(output.hookSpecificOutput.additionalContext).toBe("Write");
});

test("an unknown hook name is an error for the runner, not an allow", async () => {
  const result = await call("nope", "{}");
  expect(result.code).toBe(1);
  expect(result.stderr).toMatch(/unknown hook/i);
});

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const github = resolve(import.meta.dirname, "../../../.github");
const workflowDir = join(github, "workflows");
const workflows = readdirSync(workflowDir)
  .filter((name) => /\.ya?ml$/.test(name))
  .map((name) => ({ name, text: readFileSync(join(workflowDir, name), "utf8") }));
const actionFiles = [
  ...workflows,
  {
    name: "actions/setup/action.yml",
    text: readFileSync(join(github, "actions/setup/action.yml"), "utf8"),
  },
];

describe("GitHub workflows", () => {
  test("there is at least one workflow", () => {
    expect(workflows.length).toBeGreaterThan(0);
  });

  test("every external action is pinned to a full commit SHA", () => {
    const unpinned = actionFiles.flatMap(({ name, text }) =>
      [...text.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)]
        .map((match) => match[1])
        .filter((ref) => !ref.startsWith("./") && !/@[0-9a-f]{40}$/.test(ref))
        .map((ref) => `${name}: ${ref}`),
    );
    expect(unpinned).toEqual([]);
  });

  test("every workflow sets top-level permissions explicitly", () => {
    const missing = workflows
      .filter(({ text }) => !/^permissions:/m.test(text))
      .map(({ name }) => name);
    expect(missing).toEqual([]);
  });

  test("no workflow uses pull_request_target, which would hand secrets to fork code", () => {
    const risky = workflows
      .filter(({ text }) => /pull_request_target/.test(text))
      .map(({ name }) => name);
    expect(risky).toEqual([]);
  });
});

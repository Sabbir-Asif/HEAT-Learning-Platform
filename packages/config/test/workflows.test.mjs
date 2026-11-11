import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { load as parse } from "js-yaml";
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

  test("no workflow grants write permissions", () => {
    const writers = workflows
      .filter(({ text }) => /:\s*write\b|write-all/.test(text))
      .map(({ name }) => name);
    expect(writers).toEqual([]);
  });

  test("every required status check in branch-protection.json is reported by a job", () => {
    const { required_status_checks } = JSON.parse(
      readFileSync(join(github, "branch-protection.json"), "utf8"),
    );
    const reported = new Set(
      workflows.flatMap(({ text }) => [
        ...[...text.matchAll(/^ {4}name: (?!\$\{\{)(.+)$/gm)].map((m) => m[1].trim()),
        ...[...text.matchAll(/- \{ task: (\w+),/g)].map((m) => m[1]),
      ]),
    );
    expect(required_status_checks.contexts.filter((name) => !reported.has(name))).toEqual([]);
  });

  test("no workflow uses pull_request_target, which would hand secrets to fork code", () => {
    const risky = workflows
      .filter(({ text }) => /pull_request_target/.test(text))
      .map(({ name }) => name);
    expect(risky).toEqual([]);
  });
  describe("Migrations job", () => {
    const ci = parse(workflows.find(({ name }) => name === "ci.yml").text);
    const job = ci.jobs.migrations;
    const runs = (job?.steps ?? []).map((step) => step.run).filter(Boolean);
    const protection = JSON.parse(readFileSync(join(github, "branch-protection.json"), "utf8"));

    test("exists, with a timeout, a Postgres service and full git history", () => {
      expect(job["timeout-minutes"]).toBeGreaterThan(0);
      expect(job.services.postgres.image).toMatch(/^postgres:17/);
      const checkout = job.steps.find((step) => step.uses?.startsWith("actions/checkout@"));
      expect(checkout.with["fetch-depth"]).toBe(0);
    });

    test("checks immutability against the pull request base on pull requests only", () => {
      const step = job.steps.find((s) => s.run?.includes("migrations.mjs immutable"));
      expect(step.if).toBe("github.event_name == 'pull_request'");
      expect(step.run).toBe('node packages/config/bin/migrations.mjs immutable "$BASE_REF"');
      expect(step.env.BASE_REF).toBe("origin/${{ github.base_ref }}");
    });

    test("applies migrations, then fails on any difference from the schema", () => {
      const deploy = runs.findIndex((run) => run.includes("prisma migrate deploy"));
      const diff = runs.findIndex((run) => run.includes("prisma migrate diff"));
      expect(deploy).toBeGreaterThanOrEqual(0);
      expect(diff).toBeGreaterThan(deploy);
      expect(runs[diff]).toContain("--exit-code");
    });

    test("is not a required check until the owner adds it", () => {
      expect(protection.required_status_checks.contexts).not.toContain("migrations");
    });

    test("the pull request template links the migration review checklist", () => {
      const template = readFileSync(join(github, "pull_request_template.md"), "utf8");
      expect(template).toContain("docs/runbooks/migration-review.md");
    });
  });
});

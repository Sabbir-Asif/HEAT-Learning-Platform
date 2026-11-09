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
  describe("Storybook job", () => {
    const ci = parse(workflows.find(({ name }) => name === "ci.yml").text);
    const job = ci.jobs.storybook;
    const runs = (job?.steps ?? []).map((step) => step.run).filter(Boolean);

    test("exists, with a timeout, and runs on every pull request (no path filter)", () => {
      expect(job).toBeDefined();
      expect(job["timeout-minutes"]).toBeGreaterThan(0);
      expect(JSON.stringify(ci.on)).not.toMatch(/paths/);
    });

    test("runs the story tests and builds static Storybook", () => {
      expect(runs).toContain("pnpm --filter @heat/ui test:stories");
      expect(runs).toContain("pnpm --filter @heat/ui build-storybook");
    });

    test("installs Chromium for Playwright", () => {
      expect(runs.some((run) => /playwright install.*chromium/.test(run))).toBe(true);
    });

    test("uploads storybook-static for 7 days, also when the story tests fail", () => {
      const upload = (job?.steps ?? []).find((step) =>
        step.uses?.startsWith("actions/upload-artifact@"),
      );
      expect(upload.if).toBe("${{ !cancelled() }}");
      expect(upload.with).toMatchObject({
        name: "storybook-static",
        path: "packages/ui/storybook-static",
        "retention-days": 7,
      });
    });
  });
  describe("Lighthouse job", () => {
    const ci = parse(workflows.find(({ name }) => name === "ci.yml").text);
    const job = ci.jobs.lighthouse;
    const steps = job?.steps ?? [];
    const protection = JSON.parse(readFileSync(join(github, "branch-protection.json"), "utf8"));

    test("exists, with a timeout, and runs on every pull request (no path filter)", () => {
      expect(job).toBeDefined();
      expect(job["timeout-minutes"]).toBeGreaterThan(0);
      expect(JSON.stringify(ci.on)).not.toMatch(/paths/);
    });

    test("is not a required check", () => {
      expect(protection.required_status_checks.contexts).not.toContain("lighthouse");
    });

    test("builds the public app, installs Chromium and runs the audit without secrets", () => {
      const runs = steps.map((step) => step.run).filter(Boolean);
      expect(runs.some((run) => /playwright install.*chromium/.test(run))).toBe(true);
      expect(runs.some((run) => /build.*frontend-public/.test(run))).toBe(true);
      expect(runs).toContain("pnpm --filter @heat/e2e lighthouse");
      expect(JSON.stringify(job)).not.toMatch(/secrets\./);
    });

    test("never fails the run: the audit continues on error and the report warns", () => {
      const audit = steps.find((step) => step.run === "pnpm --filter @heat/e2e lighthouse");
      expect(audit.id).toBe("audit");
      expect(audit["continue-on-error"]).toBe(true);
      const reporter = steps.find(
        (step) => step.run === "pnpm --filter @heat/e2e lighthouse:report",
      );
      expect(reporter.if).toBe("${{ !cancelled() }}");
      expect(reporter.env.RUN_OUTCOME).toBe("${{ steps.audit.outcome }}");
      expect(reporter.env.ARTIFACT_URL).toBe("${{ steps.upload.outputs.artifact-url }}");
    });

    test("uploads the reports for 7 days, also when the audit fails", () => {
      const upload = steps.find((step) => step.uses?.startsWith("actions/upload-artifact@"));
      expect(upload.id).toBe("upload");
      expect(upload.if).toBe("${{ !cancelled() }}");
      expect(upload.with).toMatchObject({
        name: "lighthouse-reports",
        path: "packages/e2e/lighthouse-results",
        "retention-days": 7,
      });
    });
  });
});

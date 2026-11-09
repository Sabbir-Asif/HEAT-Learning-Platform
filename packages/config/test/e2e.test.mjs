import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { load as parse } from "js-yaml";
import { describe, expect, test } from "vitest";
import { image } from "../../e2e/bin/docker.mjs";
import { changedScreens, report } from "../../e2e/bin/report-visual.mjs";

const root = resolve(import.meta.dirname, "../../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const ci = parse(read(".github/workflows/ci.yml"));
const catalog = parse(read("pnpm-workspace.yaml")).catalog;

describe("Playwright pin", () => {
  test("the catalog pins Playwright once and the image tag matches it", () => {
    expect(catalog.playwright).toMatch(/^\d+\.\d+\.\d+$/);
    expect(catalog["@playwright/test"]).toBe(catalog.playwright);
    expect(image).toMatch(
      new RegExp(`:v${catalog.playwright.replaceAll(".", "\\.")}-[a-z]+@sha256:[0-9a-f]{64}$`),
    );
  });

  test("no package pins Playwright outside the catalog", () => {
    for (const path of ["packages/ui/package.json", "packages/e2e/package.json"]) {
      const { devDependencies } = JSON.parse(read(path));
      for (const name of ["playwright", "@playwright/test", "@axe-core/playwright"]) {
        if (devDependencies[name]) expect(devDependencies[name]).toBe("catalog:");
      }
    }
  });

  test("the README documents the image reference and the update command", () => {
    const readme = read("README.md");
    expect(readme).toContain(image);
    expect(readme).toContain("pnpm e2e:docker:update");
  });
});

describe("end-to-end jobs", () => {
  const protection = JSON.parse(read(".github/branch-protection.json"));
  const steps = (name) => ci.jobs[name].steps;

  test("accessibility is a required check and screenshots is not", () => {
    expect(protection.required_status_checks.contexts).toContain("accessibility");
    expect(protection.required_status_checks.contexts).not.toContain("screenshots");
  });

  test("accessibility runs the suite in the pinned image", () => {
    expect(
      steps("accessibility").some((s) => s.run === "node packages/e2e/bin/docker.mjs a11y"),
    ).toBe(true);
  });

  test("screenshots never fails the run, warns, and keeps images for 7 days", () => {
    const run = steps("screenshots").find((s) => s.id === "run");
    expect(run["continue-on-error"]).toBe(true);
    const upload = steps("screenshots").find((s) => s.uses?.startsWith("actions/upload-artifact@"));
    expect(upload.with).toMatchObject({ name: "screenshot-diffs", "retention-days": 7 });
    expect(steps("screenshots").some((s) => s.run?.includes("report-visual.mjs"))).toBe(true);
  });

  test("neither job is limited by path", () => {
    expect(JSON.stringify(ci.on)).not.toMatch(/paths/);
  });
});

describe("visual report", () => {
  const files = [
    "test-results/a/public-home-390-dark-actual.png",
    "test-results/a/public-home-390-dark-expected.png",
    "test-results/a/public-home-390-dark-diff.png",
    "test-results/b/internal-overview-1440-light-actual.png",
    "test-results/c/trace.zip",
  ];

  test("lists changed screens and flags the ones without a baseline", () => {
    expect(changedScreens(files)).toEqual([
      { name: "internal-overview-1440-light", missingBaseline: true },
      { name: "public-home-390-dark", missingBaseline: false },
    ]);
  });

  test("emits one warning naming the screens and a summary", () => {
    const { annotations, summary } = report(files, "failure");
    expect(annotations).toHaveLength(1);
    expect(annotations[0]).toMatch(
      /^::warning title=Visual changes::2 screen\(s\).*public-home-390-dark/,
    );
    expect(summary).toContain("- public-home-390-dark");
  });

  test("is quiet when nothing changed and warns when the run itself failed", () => {
    expect(report([], "success").annotations).toEqual([]);
    expect(report([], "failure").annotations[0]).toMatch(
      /^::warning title=Screenshot run did not finish/,
    );
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { load as parse } from "js-yaml";
import { describe, expect, test } from "vitest";
import { image, installScript, pnpmPin } from "../../e2e/bin/docker.mjs";
import { changedScreens, report } from "../../e2e/bin/report-visual.mjs";

const root = resolve(import.meta.dirname, "../../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
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
      for (const name of ["playwright", "@playwright/test"]) {
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

describe("pnpm inside the image", () => {
  const { packageManager } = JSON.parse(read("package.json"));

  test("the root packageManager carries a sha512 and the script checks the tarball against it", () => {
    const pin = pnpmPin(packageManager);
    const script = installScript(pin);
    expect(script).toContain(`${pin.sha512}  pnpm-${pin.version}.tgz`);
    expect(script.indexOf("sha512sum --check")).toBeLessThan(
      script.indexOf("npm install --global"),
    );
    expect(script).not.toMatch(/npm install --global --prefix \S+ pnpm@/);
  });

  test("a packageManager without a hash is rejected", () => {
    expect(() => pnpmPin("pnpm@11.28.11")).toThrow();
    expect(() => pnpmPin(undefined)).toThrow();
  });
});

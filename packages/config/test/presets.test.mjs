import { ESLint } from "eslint";
import * as prettier from "prettier";
import { describe, expect, test } from "vitest";
import prettierConfig from "../prettier/index.json" with { type: "json" };
import { DEFAULT_COVERAGE_THRESHOLD, jsdomPreset, nodePreset } from "../vitest/index.js";

const lint = async (preset, code, filePath) => {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: (await import(`../eslint/${preset}.js`)).default,
  });
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages;
};

describe("eslint presets", () => {
  for (const preset of ["base", "nest", "react"]) {
    test(`${preset} rejects an explicit any and names the rule`, async () => {
      const messages = await lint(preset, "export const value: any = 1;\n", "fixture.ts");
      expect(messages.map((m) => m.ruleId)).toContain("@typescript-eslint/no-explicit-any");
    });
  }

  test("base accepts typed code", async () => {
    expect(await lint("base", "export const value: number = 1;\n", "fixture.ts")).toEqual([]);
  });
});

describe("prettier preset", () => {
  test("flags unformatted source", async () => {
    const source = "export const a={b:1}\n";
    expect(await prettier.check(source, { ...prettierConfig, filepath: "fixture.ts" })).toBe(false);
  });

  test("accepts formatted source", async () => {
    const source = "export const a = { b: 1 };\n";
    expect(await prettier.check(source, { ...prettierConfig, filepath: "fixture.ts" })).toBe(true);
  });
});

describe("vitest presets", () => {
  const thresholds = (config) => config.test.coverage.thresholds;

  test("apply the default threshold when a package sets none", () => {
    for (const config of [nodePreset(), jsdomPreset()]) {
      expect(thresholds(config)).toEqual({
        lines: DEFAULT_COVERAGE_THRESHOLD,
        functions: DEFAULT_COVERAGE_THRESHOLD,
        branches: DEFAULT_COVERAGE_THRESHOLD,
        statements: DEFAULT_COVERAGE_THRESHOLD,
      });
    }
    expect(DEFAULT_COVERAGE_THRESHOLD).toBe(85);
  });

  test("let a package raise the threshold to 100", () => {
    expect(thresholds(nodePreset({ threshold: 100 }))).toEqual({
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100,
    });
  });

  test("use the right test environment and keep default exclusions", () => {
    expect(nodePreset().test.environment).toBe("node");
    expect(jsdomPreset().test.environment).toBe("jsdom");
    expect(nodePreset({ coverageExclude: ["src/app/**"] }).test.coverage.exclude).toEqual(
      expect.arrayContaining(["src/main.ts", "src/app/**"]),
    );
  });
});

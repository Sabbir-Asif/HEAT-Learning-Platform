import { defineConfig } from "vitest/config";

export const DEFAULT_COVERAGE_THRESHOLD = 85;

function preset(
  environment,
  { threshold = DEFAULT_COVERAGE_THRESHOLD, coverageExclude = [] } = {},
) {
  return defineConfig({
    test: {
      environment,
      testTimeout: 15000,
      include: ["test/**/*.test.{ts,tsx,mjs}"],
      coverage: {
        provider: "v8",
        reporter: ["text", "lcov"],
        include: ["src/**"],
        exclude: ["**/*.d.ts", "src/main.ts", ...coverageExclude],
        thresholds: {
          lines: threshold,
          functions: threshold,
          branches: threshold,
          statements: threshold,
        },
      },
    },
  });
}

export const nodePreset = (options) => preset("node", options);

export const jsdomPreset = (options) => preset("jsdom", options);

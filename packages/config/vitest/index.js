import { defineConfig } from "vitest/config";

/** Minimum coverage, in percent, applied to every package unless it sets its own. */
export const DEFAULT_COVERAGE_THRESHOLD = 85;

/**
 * @typedef {object} PresetOptions
 * @property {number} [threshold] Coverage threshold override in percent; use 100 for rule packages.
 * @property {string[]} [coverageExclude] Extra globs left out of coverage, added to the defaults.
 */

/**
 * @param {"node" | "jsdom"} environment
 * @param {PresetOptions} options
 */
function preset(
  environment,
  { threshold = DEFAULT_COVERAGE_THRESHOLD, coverageExclude = [] } = {},
) {
  return defineConfig({
    test: {
      environment,
      coverage: {
        provider: "v8",
        reporter: ["text", "lcov"],
        include: ["src/**"],
        exclude: ["**/*.test.*", "**/*.d.ts", "src/main.ts", ...coverageExclude],
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

/** Vitest config for packages that run in Node. */
export const nodePreset = (/** @type {PresetOptions} */ options) => preset("node", options);

/** Vitest config for packages that render React or touch the DOM. */
export const jsdomPreset = (/** @type {PresetOptions} */ options) => preset("jsdom", options);

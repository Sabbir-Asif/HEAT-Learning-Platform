import path from "node:path";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Story tests: every story is rendered in Chromium and checked with axe. Kept apart from
// vitest.config.mjs so `pnpm test` and the coverage gate never start a browser.
export default defineConfig({
  plugins: [
    storybookTest({
      configDir: path.join(import.meta.dirname, ".storybook"),
      storybookScript: "pnpm storybook",
    }),
  ],
  test: {
    name: "stories",
    browser: {
      enabled: true,
      provider: playwright({}),
      headless: true,
      instances: [{ browser: "chromium" }],
    },
  },
});

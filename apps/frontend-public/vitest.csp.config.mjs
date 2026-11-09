import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["spikes/csp/test/**/*.test.ts"],
    testTimeout: 120000,
    hookTimeout: 300000,
  },
});

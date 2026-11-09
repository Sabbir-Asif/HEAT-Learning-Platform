import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/integration/**/*.integration.test.ts"],
    globalSetup: ["test/integration/global-setup.ts"],
    testTimeout: 60000,
    hookTimeout: 120000,
  },
});

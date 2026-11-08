import { defineConfig, devices } from "@playwright/test";

const port = 3200;
const ci = Boolean(process.env["CI"]);

export default defineConfig({
  testDir: "./test/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm build && pnpm start",
    url: `http://127.0.0.1:${port}/bn`,
    env: { PORT: String(port), HOSTNAME: "127.0.0.1" },
    reuseExistingServer: !ci,
    timeout: 300_000,
  },
});

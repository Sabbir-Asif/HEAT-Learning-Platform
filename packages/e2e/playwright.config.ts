import { defineConfig } from "@playwright/test";

const ports = { public: 3000, internal: 3001 } as const;

const fakeAdminApiPort = 4010;

const server = (app: "public" | "internal") => ({
  command: `node packages/e2e/bin/standalone.mjs frontend-${app} ${ports[app]}`,
  cwd: "../..",
  url: `http://localhost:${ports[app]}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
  env: {
    NEXT_TELEMETRY_DISABLED: "1",
    API_INTERNAL_URL: `http://localhost:${fakeAdminApiPort}`,
  },
});

const fakeAdminApi = {
  command: `node packages/e2e/bin/fake-admin-api.mjs ${fakeAdminApiPort}`,
  cwd: "../..",
  url: `http://localhost:${fakeAdminApiPort}/api/admin/me`,
  reuseExistingServer: !process.env.CI,
  timeout: 30_000,
};

export default defineConfig({
  testMatch: "**/*.e2e.ts",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : [["list"]],
  expect: {
    toHaveScreenshot: { animations: "disabled", caret: "hide", scale: "css" },
  },
  use: { browserName: "chromium", reducedMotion: "reduce", locale: "en-US" },
  projects: [
    {
      name: "public",
      testDir: "test/public",
      use: { baseURL: `http://localhost:${ports.public}` },
    },
    {
      name: "internal",
      testDir: "test/internal",
      use: { baseURL: `http://localhost:${ports.internal}` },
    },
    {
      name: "internal-stack",
      testDir: "test/internal-stack",
      use: { baseURL: process.env.E2E_ADMIN_URL ?? "http://admin.localhost" },
    },
  ],
  webServer: [fakeAdminApi, server("public"), server("internal")],
});

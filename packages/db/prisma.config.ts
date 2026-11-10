import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

const apiEnvFile = resolve(process.cwd(), "../../apps/api/.env");

if (!process.env["DATABASE_URL"] && existsSync(apiEnvFile)) {
  process.loadEnvFile(apiEnvFile);
}

export default defineConfig({
  schema: "prisma/schema",
  migrations: { path: "prisma/migrations", seed: "tsx src/seed-cli.ts" },
  datasource: { url: process.env["DATABASE_URL"] },
});

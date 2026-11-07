// pnpm dev:up | dev:down | dev:reset — manage the local Docker Compose stack.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const composeFile = join(root, "infra/compose/docker-compose.dev.yml");
const envDirs = [
  "infra/compose",
  "apps/api",
  "apps/worker",
  "apps/frontend-public",
  "apps/frontend-internal",
];
const waitSeconds = 60;

const compose = (...args) => {
  const { status } = spawnSync("docker", ["compose", "-f", composeFile, ...args], {
    stdio: "inherit",
  });
  if (status !== 0) process.exit(status ?? 1);
};

// A fresh clone has only .env.example files; copy them so the stack and apps start.
function ensureEnvFiles() {
  for (const dir of envDirs) {
    const target = join(root, dir, ".env");
    if (existsSync(target)) continue;
    copyFileSync(join(root, dir, ".env.example"), target);
    console.log(`Created ${dir}/.env from .env.example`);
  }
}

const up = () => {
  ensureEnvFiles();
  compose("up", "--detach", "--wait", "--wait-timeout", String(waitSeconds));
};

const commands = {
  up,
  down: () => compose("down"),
  // Drops the volumes, so Postgres and Redis come back empty.
  reset: () => {
    compose("down", "--volumes");
    up();
  },
};

const command = commands[process.argv[2]];
if (!command) {
  console.error(`Usage: node infra/scripts/dev.mjs <${Object.keys(commands).join("|")}>`);
  process.exit(1);
}
command();

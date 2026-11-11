import { spawnSync } from "node:child_process";
import { chmodSync, constants, copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const composeFile = join(root, "infra/compose/docker-compose.dev.yml");
const projectName = "heat-lms-dev";
const envDirs = [
  "infra/compose",
  "apps/api",
  "apps/worker",
  "apps/frontend-public",
  "apps/frontend-internal",
];
const waitSeconds = 60;

const compose = (...args) => {
  const { status, error } = spawnSync(
    "docker",
    ["compose", "-p", projectName, "-f", composeFile, ...args],
    { stdio: "inherit" },
  );
  if (error) console.error(`Could not run docker (${error.message}). Is Docker installed?`);
  if (status !== 0) process.exit(status ?? 1);
};

function ensureEnvFiles() {
  for (const dir of envDirs) {
    const target = join(root, dir, ".env");
    if (existsSync(target)) continue;
    copyFileSync(join(root, dir, ".env.example"), target, constants.COPYFILE_EXCL);
    chmodSync(target, 0o600);
    console.log(`Created ${dir}/.env from .env.example`);
  }
}

const nginxAnswers = (port) =>
  fetch(`http://127.0.0.1:${port}/nginx-health`, { signal: AbortSignal.timeout(1000) }).then(
    (response) => response.ok,
    () => false,
  );

const nginxReachable = async (seconds) => {
  const env = readFileSync(join(root, "infra/compose/.env"), "utf8");
  const port = env.match(/^HTTP_PORT=(\d+)$/m)?.[1] ?? "80";
  for (let attempt = 0; attempt < seconds; attempt++) {
    if (await nginxAnswers(port)) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
};

const ensureDirectory = (variable, fallback) => {
  const env = readFileSync(join(root, "infra/compose/.env"), "utf8");
  const configured = env.match(new RegExp(`^${variable}=(.+)$`, "m"))?.[1];
  mkdirSync(resolve(dirname(composeFile), configured ?? fallback), { recursive: true });
};

const ensureMediaDirectory = () => {
  ensureDirectory("HLS_MEDIA_DIR", "../../.data/hls");
  ensureDirectory("CERTIFICATE_STORAGE_DIR", "../../.data/certificates");
};

const up = async () => {
  ensureMediaDirectory();
  compose("up", "--detach", "--wait", "--wait-timeout", String(waitSeconds));
  if (!(await nginxReachable(2))) {
    console.log("Nginx is healthy but not reachable on the host; restarting it once.");
    compose("restart", "nginx");
    if (!(await nginxReachable(15))) {
      console.error("Nginx is still not reachable on the host port.");
      process.exit(1);
    }
  }
};

const commands = {
  up,
  down: () => compose("down"),
  reset: async () => {
    compose("down", "--volumes");
    await up();
  },
};

const command = Object.hasOwn(commands, process.argv[2]) ? commands[process.argv[2]] : undefined;
if (!command) {
  console.error(`Usage: node infra/scripts/dev.mjs <${Object.keys(commands).join("|")}>`);
  process.exit(1);
}
ensureEnvFiles();
await command();

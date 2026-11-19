import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sites = ["frontend-public", "frontend-internal"];

const services = [
  {
    name: "api",
    cwd: "apps/api",
    args: ["--env-file=.env", "dist/main.js"],
    ready: "apps/api/dist/main.js",
  },
  {
    name: "worker",
    cwd: "apps/worker",
    args: ["--env-file=../api/.env", "dist/main.js"],
    ready: "apps/worker/dist/main.js",
  },
  {
    name: "public",
    cwd: "apps/frontend-public",
    args: [".next/standalone/apps/frontend-public/server.js"],
    env: { PORT: "3000" },
    ready: "apps/frontend-public/.next/standalone/apps/frontend-public/server.js",
  },
  {
    name: "admin",
    cwd: "apps/frontend-internal",
    args: [".next/standalone/apps/frontend-internal/server.js"],
    env: { PORT: "3001" },
    ready: "apps/frontend-internal/.next/standalone/apps/frontend-internal/server.js",
  },
];

const build = () => {
  const { status, error } = spawnSync("pnpm", ["build"], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (error) console.error(`Could not run pnpm (${error.message}).`);
  if (status !== 0) process.exit(status ?? 1);
  for (const site of sites) {
    const standalone = join(root, "apps", site, ".next/standalone/apps", site);
    cpSync(join(root, "apps", site, ".next/static"), join(standalone, ".next/static"), {
      recursive: true,
    });
    cpSync(join(root, "apps", site, "public"), join(standalone, "public"), { recursive: true });
  }
  console.log("Built. Run pnpm demo to start the API, the worker and both sites.");
};

const migrate = () => {
  const { status, error } = spawnSync("pnpm", ["db:migrate"], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (error) console.error(`Could not run pnpm (${error.message}).`);
  if (status !== 0) {
    console.error("Could not migrate the database. Run pnpm dev:up first.");
    process.exit(status ?? 1);
  }
};

const prefixLines = (name, stream, target) => {
  let pending = "";
  stream.on("data", (chunk) => {
    const lines = (pending + chunk).split(/\r?\n/);
    pending = lines.pop() ?? "";
    for (const line of lines) target.write(`[${name}] ${line}\n`);
  });
  stream.on("end", () => {
    if (pending) target.write(`[${name}] ${pending}\n`);
  });
};

const start = () => {
  const missing = services.filter((service) => !existsSync(join(root, service.ready)));
  if (missing.length > 0) {
    console.error(
      `Nothing to run for: ${missing.map((s) => s.name).join(", ")}. Run pnpm demo:build first.`,
    );
    process.exit(1);
  }
  migrate();
  const children = services.map((service) => {
    const child = spawn(process.execPath, service.args, {
      cwd: join(root, service.cwd),
      env: { ...process.env, ...service.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    prefixLines(service.name, child.stdout, process.stdout);
    prefixLines(service.name, child.stderr, process.stderr);
    child.on("exit", (code, signal) => {
      console.error(`[${service.name}] stopped (${signal ?? code}). Stopping the rest.`);
      stop(code ?? 1);
    });
    return child;
  });
  let stopping = false;
  const stop = (code) => {
    if (stopping) return;
    stopping = true;
    for (const child of children) child.kill();
    setTimeout(() => process.exit(code), 500);
  };
  process.on("SIGINT", () => stop(0));
  process.on("SIGTERM", () => stop(0));
  console.log("Open http://learn.localhost and http://admin.localhost. Ctrl+C stops everything.");
};

const commands = { build, start };

const command = Object.hasOwn(commands, process.argv[2]) ? commands[process.argv[2]] : undefined;
if (!command) {
  console.error(`Usage: node infra/scripts/demo.mjs <${Object.keys(commands).join("|")}>`);
  process.exit(1);
}
command();

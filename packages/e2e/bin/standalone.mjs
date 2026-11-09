import { spawn } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");

export function standaloneDir(app) {
  return join(root, "apps", app, ".next/standalone/apps", app);
}

export function prepareStandalone(app) {
  const source = join(root, "apps", app);
  const target = standaloneDir(app);
  if (!existsSync(join(target, "server.js"))) {
    throw new Error(`No standalone build for ${app}. Run pnpm turbo build --filter=${app} first.`);
  }
  rmSync(join(target, ".next/static"), { recursive: true, force: true });
  cpSync(join(source, ".next/static"), join(target, ".next/static"), { recursive: true });
  if (existsSync(join(source, "public"))) {
    rmSync(join(target, "public"), { recursive: true, force: true });
    cpSync(join(source, "public"), join(target, "public"), { recursive: true });
  }
  return target;
}

export function spawnStandalone(app, port, options = {}) {
  const dir = prepareStandalone(app);
  return spawn(process.execPath, ["server.js"], {
    cwd: dir,
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: "localhost",
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    ...options,
  });
}

function main(app, port) {
  if (!app || !port) {
    console.error("Usage: node bin/standalone.mjs <frontend-public|frontend-internal> <port>");
    return 2;
  }
  const child = spawnStandalone(app, port, { stdio: "inherit" });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
  child.on("exit", (code) => process.exit(code ?? 0));
  return undefined;
}

if (process.argv[1] === import.meta.filename) {
  const code = main(process.argv[2], process.argv[3]);
  if (code !== undefined) process.exitCode = code;
}

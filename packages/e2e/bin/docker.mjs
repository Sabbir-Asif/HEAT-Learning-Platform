import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

export const image =
  "mcr.microsoft.com/playwright:v1.65.0-noble@sha256:6e3fb709361521eb27161606e6da6d2674e5e89fa16516cb37d6fdd91372273d";

const root = resolve(import.meta.dirname, "../../..");
const pkg = join(root, "packages/e2e");
const modes = {
  update: "pnpm exec playwright test screenshots --update-snapshots",
  visual: "pnpm exec playwright test screenshots",
};

export function pnpmPin(packageManager) {
  const match = /^pnpm@(\d+\.\d+\.\d+)\+sha512\.([0-9a-f]{128})$/.exec(packageManager ?? "");
  if (!match) throw new Error("packageManager in package.json must be pnpm@X.Y.Z+sha512.<hex>");
  return { version: match[1], sha512: match[2] };
}

export function installScript({ version, sha512 }) {
  return [
    "set -e",
    "export HOME=/work/.home",
    "export PATH=$HOME/.npm-global/bin:$PATH",
    "cd $HOME",
    `npm pack pnpm@${version} --silent`,
    `echo "${sha512}  pnpm-${version}.tgz" | sha512sum --check --strict -`,
    `npm install --global --prefix $HOME/.npm-global ./pnpm-${version}.tgz`,
    "cd /work",
    "pnpm install --frozen-lockfile",
    "pnpm turbo build --filter=frontend-public --filter=frontend-internal --concurrency=1",
    "cd packages/e2e",
  ].join("\n");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function trackedFiles() {
  const result = spawnSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return result.stdout.split("\0").filter(Boolean);
}

function screenshotDirs(base) {
  const testDir = join(base, "packages/e2e/test");
  return readdirSync(testDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "support")
    .map((entry) => join(testDir, entry.name, "__screenshots__"));
}

export function main(mode) {
  const command = modes[mode];
  if (!command) {
    console.error(`Usage: node bin/docker.mjs <${Object.keys(modes).join("|")}>`);
    return 2;
  }
  const work = mkdtempSync(join(pkg, ".work-"));
  try {
    for (const file of trackedFiles()) {
      cpSync(join(root, file), join(work, file), { recursive: true });
    }
    mkdirSync(join(work, ".home"));
    const user =
      typeof process.getuid === "function"
        ? ["--user", `${process.getuid()}:${process.getgid()}`]
        : [];
    const pin = pnpmPin(
      JSON.parse(readFileSync(join(root, "package.json"), "utf8")).packageManager,
    );
    const script = `${installScript(pin)}\n${command}`;
    const status = run("docker", [
      "run",
      "--rm",
      "--init",
      "--ipc=host",
      ...user,
      "-e",
      "CI=1",
      "-e",
      "NEXT_TELEMETRY_DISABLED=1",
      "-v",
      `${work}:/work`,
      "-w",
      "/work",
      image,
      "bash",
      "-c",
      script,
    ]);
    if (mode === "update") {
      if (status !== 0) return status;
      const fresh = screenshotDirs(work);
      for (const dir of screenshotDirs(root)) rmSync(dir, { recursive: true, force: true });
      for (const dir of fresh) {
        const target = join(root, dir.slice(work.length + 1));
        cpSync(dir, target, { recursive: true });
      }
    } else {
      rmSync(join(pkg, "test-results"), { recursive: true, force: true });
      rmSync(join(pkg, "playwright-report"), { recursive: true, force: true });
      for (const name of ["test-results", "playwright-report"]) {
        try {
          cpSync(join(work, "packages/e2e", name), join(pkg, name), { recursive: true });
        } catch {
          continue;
        }
      }
    }
    return status;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] === import.meta.filename) process.exitCode = main(process.argv[2]);

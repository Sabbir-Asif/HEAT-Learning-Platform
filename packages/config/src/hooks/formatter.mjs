import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { targetOf } from "./edit-guards.mjs";
import { repoOf } from "./git.mjs";
import { resolveReal } from "./paths.mjs";
import { updateState } from "./state.mjs";

const toolTimeout = 30000;
const maxReport = 2000;
const typedFile = /\.(?:ts|tsx|mts|cts)$|(?:^|\/)tsconfig[^/]*\.json$|(?:^|\/)package\.json$/;
const scriptFile = /\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)$/;
const binaryFile = /\.(?:png|jpe?g|gif|webp|avif|ico|pdf|woff2?|ttf|otf|mp4|webm|zip)$/i;
const generated = ["packages/api-client/src/generated/", "apps/api/openapi.json"];

export function runTool(command, args, options) {
  const result = spawnSync(command, args, {
    ...options,
    encoding: "utf8",
    timeout: toolTimeout,
    maxBuffer: 16 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.error) return { status: 2, output: result.error.message };
  return { status: result.status ?? 2, output };
}

function packageDirectory(real, top) {
  let current = dirname(real);
  while (current !== top && current.startsWith(top)) {
    if (existsSync(join(current, "package.json"))) return current;
    current = dirname(current);
  }
  return top;
}

function binary(name, packageDir, top) {
  return [packageDir, top]
    .map((dir) => join(dir, "node_modules", ".bin", name))
    .find((path) => existsSync(path));
}

const hasEslintConfig = (dir) =>
  existsSync(dir) && readdirSync(dir).some((name) => /^eslint\.config\.[cm]?[jt]s$/.test(name));

const cut = (text) => text.trim().slice(0, maxReport);

export function formatter(input, deps = {}) {
  const { env = process.env, run = runTool } = deps;
  const real = resolveReal(targetOf(input), input.cwd || process.cwd());
  if (!existsSync(real) || !statSync(real).isFile()) return {};
  const top = repoOf(real);
  if (!top) return {};
  const path = relative(top, real);
  if (typedFile.test(path)) {
    updateState(input.session_id, { worktree: top, typedDirty: true }, env);
  }
  if (
    path.startsWith("docs/") ||
    binaryFile.test(path) ||
    generated.some((entry) => path.startsWith(entry))
  ) {
    return {};
  }

  const packageDir = packageDirectory(real, top);
  const prettier = binary("prettier", packageDir, top);
  if (!prettier)
    return { context: "Formatter skipped: node_modules is missing; run pnpm install." };

  const notes = [];
  const eslint = binary("eslint", packageDir, top);
  if (eslint && scriptFile.test(path) && packageDir !== top && hasEslintConfig(packageDir)) {
    const lint = run(eslint, ["--fix", "--no-warn-ignored", real], { cwd: packageDir });
    if (lint.status !== 0) notes.push(`ESLint left problems in ${path}:\n${cut(lint.output)}`);
  }

  const prettierArgs = ["--write", "--ignore-unknown"];
  if (packageDir !== top) {
    prettierArgs.push("--ignore-path", join(top, ".gitignore"));
    const own = join(packageDir, ".prettierignore");
    if (existsSync(own)) prettierArgs.push("--ignore-path", own);
  }
  const format = run(prettier, [...prettierArgs, real], { cwd: packageDir });
  if (format.status !== 0) notes.push(`Prettier could not format ${path}:\n${cut(format.output)}`);
  return notes.length ? { context: notes.join("\n") } : {};
}

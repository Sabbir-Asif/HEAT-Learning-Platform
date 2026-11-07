import { basename } from "node:path";
import { envAccess, isEnvFile } from "./env-files.mjs";
import { gitInvocation } from "./invocation.mjs";
import { parseShell } from "./shell.mjs";

const fileTools = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

const envDenial = (path) =>
  `Access to environment files is denied: ${path}. They hold secrets; ask the owner for the value you need instead.`;

function firstEnvPath(paths) {
  return paths.find((path) => typeof path === "string" && isEnvFile(path)) ?? null;
}

const runners = new Set(["pnpm", "pnpx", "npx", "npm", "yarn", "bunx", "bun", "corepack"]);
const forceLong = /^--(?:for(?:c(?:e(?:-with-lease|-if-includes)?)?)?|mi\w*)(?:=|$)/;
const forceShort = /^-[a-zA-Z]*f[a-zA-Z]*$/;

const forceDenial =
  "Force pushes are blocked (hard rule: never force-push). Push normally; if history has to change, ask the owner.";
const resetDenial =
  "prisma migrate reset is blocked (hard rule). It drops the database; ask the owner if a reset is really needed.";

function isForcePush(command) {
  const git = gitInvocation(command);
  if (git?.sub !== "push") return false;
  return git.args.some(
    (arg) =>
      forceLong.test(arg) || forceShort.test(arg) || (!arg.startsWith("-") && arg.startsWith("+")),
  );
}

const isPrisma = (word) => basename(word).replace(/@.*$/, "") === "prisma";

function isMigrateReset(command) {
  const [program = "", ...rest] = command.words;
  let after;
  if (isPrisma(program)) after = rest;
  else if (runners.has(basename(program))) {
    const at = rest.findIndex(isPrisma);
    if (at < 0) return false;
    after = rest.slice(at + 1);
  } else return false;
  const migrate = after.indexOf("migrate");
  return migrate >= 0 && after.slice(migrate + 1).find((word) => !word.startsWith("-")) === "reset";
}

function checkBash(input) {
  const command = input.tool_input?.command;
  if (typeof command !== "string") throw new Error("Bash input has no command");
  const commands = parseShell(command, input.cwd || process.cwd());
  const envPath = envAccess(commands);
  if (envPath) return { deny: envDenial(envPath) };
  if (commands.some(isForcePush)) return { deny: forceDenial };
  if (commands.some(isMigrateReset)) return { deny: resetDenial };
  return {};
}

export function dangerGuard(input) {
  const tool = input.tool_name;
  const toolInput = input.tool_input ?? {};
  if (tool === "Bash") return checkBash(input);
  let paths = [];
  if (tool === "Read") paths = [toolInput.file_path];
  else if (tool === "Grep") paths = [toolInput.path, toolInput.glob];
  else if (tool === "Glob") paths = [toolInput.pattern, toolInput.path];
  else if (fileTools.has(tool)) paths = [toolInput.file_path ?? toolInput.notebook_path];
  const envPath = firstEnvPath(paths);
  return envPath ? { deny: envDenial(envPath) } : {};
}

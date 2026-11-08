import { basename, resolve, sep } from "node:path";
import { branchDenial, locate, planDenial } from "./edit-guards.mjs";
import { envAccess, isEnvFile } from "./env-files.mjs";
import { existsInBase } from "./git.mjs";
import { resolveReal } from "./paths.mjs";
import { gitInvocation } from "./invocation.mjs";
import { parseShell } from "./shell.mjs";

const fileTools = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

const envDenial = (path) =>
  `Access to environment files is denied: ${path}. They hold secrets; ask the owner for the value you need instead.`;

const migrationPath = /(?:^|\/)prisma\/migrations(?:\/|$)/i;
const scratchTarget = /^(?:\$SCRATCH|\$\{SCRATCH\})(?:\/|$)/;
const scriptOptions = new Set(["-e", "-f", "-E", "--expression", "--file"]);
const directoryOptions = new Set(["-t", "--target-directory"]);

const gitDenial = (path) =>
  `${path} is inside .git, a verification marker or the local Claude settings. Hooks, config, markers and local permissions there would bypass the guards, so only git and pnpm verify write them. settings.local.json is the owner's file.`;

function gitInternals(real) {
  const segments = real.toLowerCase().split(sep);
  return (
    segments.includes(".git") ||
    segments.at(-1) === "heat-verified" ||
    (segments.at(-1) === "settings.local.json" && segments.at(-2) === ".claude")
  );
}

const migrationDenial = (path) =>
  `${path} is an applied migration (it exists on origin/main or an epic branch) and is never edited after merge. Add a new migration instead.`;

function positionalArguments(args, valueOptions) {
  const positional = [];
  let literal = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!literal && arg === "--") literal = true;
    else if (!literal && valueOptions.has(arg)) i += 1;
    else if (arg !== "" && (literal || !arg.startsWith("-"))) positional.push(arg);
  }
  return positional;
}

function optionValue(args, names) {
  for (let i = 0; i < args.length; i += 1) {
    if (names.includes(args[i])) return args[i + 1];
    const inline = names.find((name) => name.startsWith("--") && args[i].startsWith(`${name}=`));
    if (inline) return args[i].slice(inline.length + 1);
  }
  return undefined;
}

function gitTargets(git) {
  if (["rm", "mv"].includes(git.sub)) {
    return positionalArguments(git.args, new Set()).map((target) => resolve(git.cwd, target));
  }
  if (["checkout", "restore"].includes(git.sub)) {
    const separator = git.args.indexOf("--");
    return separator < 0
      ? []
      : git.args.slice(separator + 1).map((target) => resolve(git.cwd, target));
  }
  return [];
}

function writeTargets(command) {
  const [program = "", ...args] = command.words;
  const name = basename(program);
  const git = gitInvocation(command);
  if (git) return gitTargets(git);
  if (["tee", "rm", "mv"].includes(name)) return positionalArguments(args, new Set());
  if (name === "cp" || name === "install") {
    const targetDirectory = optionValue(args, ["-t", "--target-directory"]);
    if (targetDirectory) return [targetDirectory];
    const positional = positionalArguments(args, directoryOptions);
    return positional.length > 1 ? [positional.at(-1)] : [];
  }
  if (name === "dd") return args.filter((arg) => arg.startsWith("of=")).map((arg) => arg.slice(3));
  const inPlace = args.some((arg) => /^-[a-zA-Z]*i/.test(arg) || arg.startsWith("--in-place"));
  if ((name === "sed" || name === "perl") && inPlace) {
    const positional = positionalArguments(args, scriptOptions);
    return args.some((arg) => scriptOptions.has(arg)) ? positional : positional.slice(1);
  }
  return [];
}

function isAlwaysAllowed(target) {
  if (target.startsWith("/dev/")) return true;
  const match = scratchTarget.exec(target);
  return Boolean(match) && !target.slice(match[0].length).split("/").includes("..");
}

function writeDenial(target, cwd) {
  if (isAlwaysAllowed(target)) return null;
  if (scratchTarget.test(target)) {
    return `The write target "${target}" climbs out of $SCRATCH with "..". Use a path inside $SCRATCH, or the Write tool.`;
  }
  if (/[$`]/.test(target)) {
    return `The write target "${target}" contains an unexpanded variable, so the guard cannot tell where it lands. Use the Write tool with an absolute path (or $SCRATCH for scratch files).`;
  }
  const real = resolveReal(target, cwd);
  if (gitInternals(real)) return gitDenial(real);
  const location = locate(target, cwd);
  if (!location) return null;
  if (isEnvFile(location.real)) return envDenial(location.real);
  const reason = branchDenial(location) ?? planDenial(location);
  if (reason) return `Shell write blocked. ${reason}`;
  return migrationDenialFor(location);
}

function migrationDenialFor(location) {
  if (!migrationPath.test(location.relative)) return null;
  return existsInBase(location.top, location.relative) ? migrationDenial(location.real) : null;
}

function firstEnvPath(paths) {
  return paths.find((path) => typeof path === "string" && isEnvFile(path)) ?? null;
}

const runners = new Set(["pnpm", "pnpx", "npx", "npm", "yarn", "bunx", "bun", "corepack"]);
const configReads = ["--list", "-l", "--name-only"];
const configWrites = new Set([
  "--add",
  "--replace-all",
  "--unset",
  "--unset-all",
  "--rename-section",
  "--remove-section",
]);
const configValueFlags = new Set(["--file", "-f", "--blob", "--type", "--default", "--comment"]);
const configKeys = new Set([
  "core.hookspath",
  "core.fsmonitor",
  "core.sshcommand",
  "core.editor",
  "core.pager",
  "core.askpass",
  "core.gitproxy",
  "sequence.editor",
  "credential.helper",
  "diff.external",
  "gpg.program",
  "include.path",
  "uploadpack.packobjectshook",
]);
const configKeyPatterns = [
  /^alias\./,
  /^includeif\./,
  /^filter\./,
  /^credential\..*\.helper$/,
  /^diff\..*\.(?:textconv|command)$/,
  /^merge\..*\.driver$/,
  /^gpg\..*\.program$/,
  /^url\..*\.(?:push)?insteadof$/,
];
const configDenial =
  "git config of keys that run commands or redirect remotes (core.hooksPath, core.fsmonitor, core.sshCommand, core.editor, alias.*, filter.*, credential.helper, url.*.insteadOf and similar) is blocked: it would let a later git command run arbitrary code outside the guards.";
const forceLong = /^--(?:for(?:c(?:e(?:-with-lease|-if-includes)?)?)?|mi\w*)(?:=|$)/;
const forceShort = /^-[a-zA-Z]*f[a-zA-Z]*$/;

const forceDenial =
  "Force pushes are blocked (hard rule: never force-push). Push normally; if history has to change, ask the owner.";
const resetDenial =
  "prisma migrate reset and prisma db push --force-reset are blocked (hard rule). They drop the database; ask the owner if a reset is really needed.";

function isConfigWrite(command) {
  const git = gitInvocation(command);
  if (git?.sub !== "config") return false;
  if (git.args.some((arg) => configReads.includes(arg) || arg.startsWith("--get"))) return false;
  const positional = positionalArguments(git.args, configValueFlags);
  const key = (positional[0] ?? "").toLowerCase();
  if (!configKeys.has(key) && !configKeyPatterns.some((pattern) => pattern.test(key))) {
    return false;
  }
  return positional.length > 1 || git.args.some((arg) => configWrites.has(arg));
}

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
  if (migrate >= 0 && after.slice(migrate + 1).find((word) => !word.startsWith("-")) === "reset") {
    return true;
  }
  const push = after.indexOf("db");
  return (
    push >= 0 &&
    after.slice(push + 1).find((word) => !word.startsWith("-")) === "push" &&
    after.includes("--force-reset")
  );
}

function checkBash(input) {
  const command = input.tool_input?.command;
  if (typeof command !== "string") throw new Error("Bash input has no command");
  const commands = parseShell(command, input.cwd || process.cwd());
  const envPath = envAccess(commands);
  if (envPath) return { deny: envDenial(envPath) };
  if (commands.some(isForcePush)) return { deny: forceDenial };
  if (commands.some(isConfigWrite)) return { deny: configDenial };
  if (commands.some(isMigrateReset)) return { deny: resetDenial };
  for (const command of commands) {
    for (const target of [...command.writes, ...writeTargets(command)]) {
      const deny = writeDenial(target, command.cwd);
      if (deny) return { deny };
    }
  }
  return {};
}

export function dangerGuard(input) {
  const tool = input.tool_name;
  const toolInput = input.tool_input ?? {};
  if (tool === "Bash") return checkBash(input);
  const cwd = input.cwd || process.cwd();
  let paths = [];
  let real = [];
  if (tool === "Read") paths = real = [toolInput.file_path];
  else if (tool === "Grep") {
    paths = [toolInput.path, toolInput.glob];
    real = [toolInput.path];
  } else if (tool === "Glob") {
    paths = [toolInput.pattern, toolInput.path];
    real = [toolInput.path];
  } else if (fileTools.has(tool)) paths = real = [toolInput.file_path ?? toolInput.notebook_path];
  const resolved = real
    .filter((path) => typeof path === "string" && path)
    .map((path) => resolveReal(path, cwd));
  const envPath = firstEnvPath([...paths, ...resolved]);
  if (envPath) return { deny: envDenial(envPath) };
  if (!fileTools.has(tool)) return {};
  const [target] = resolved.length ? resolved : [resolveReal(paths[0], cwd)];
  if (gitInternals(target)) return { deny: gitDenial(target) };
  const location = locate(paths[0], input.cwd);
  const deny = location && migrationDenialFor(location);
  return deny ? { deny } : {};
}

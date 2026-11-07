import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";

const plainName = /^[\w.*?[\]@+-]+$/;
const safeCommands = new Set([
  "ls",
  "stat",
  "test",
  "[",
  "[[",
  "echo",
  "printf",
  "chmod",
  "rm",
  "touch",
  "cd",
  "pwd",
]);
const safeGitSubcommands = new Set([
  "add",
  "rm",
  "status",
  "check-ignore",
  "ls-files",
  "commit",
  "reset",
]);

export function isEnvFile(path) {
  const name = path.replace(/\/+$/, "").split("/").pop().toLowerCase();
  if (!plainName.test(name) || name === ".env.example") return false;
  return /^\.env(?:$|[.*?[])/.test(name) || name === ".envrc" || name.endsWith(".env");
}

const searchPrograms = new Set(["rg", "grep", "egrep", "fgrep", "ag", "ack"]);
const searchValueFlags = new Set([
  "-f",
  "-m",
  "-A",
  "-B",
  "-C",
  "-g",
  "--glob",
  "--iglob",
  "-t",
  "--type",
  "-T",
  "--include",
  "--exclude",
  "--max-count",
  "--max-depth",
  "-d",
  "-j",
  "-M",
  "--file",
]);
const searchPatternFlags = new Set(["-e", "--regexp"]);
const gitPatternFlags = new Set(["-S", "-G", "--grep", "-e"]);

function gitSubcommandIndex(words) {
  for (let i = 1; i < words.length; i += 1) {
    if (["-C", "-c", "--git-dir", "--work-tree"].includes(words[i])) i += 1;
    else if (!words[i].startsWith("-")) return i;
  }
  return -1;
}

function gitSubcommand(words) {
  return words[gitSubcommandIndex(words)] ?? null;
}

function searchPatterns(words, start) {
  const indexes = new Set();
  let firstPositional = -1;
  for (let i = start; i < words.length; i += 1) {
    if (searchPatternFlags.has(words[i])) {
      indexes.add(i + 1);
      i += 1;
    } else if (searchValueFlags.has(words[i])) i += 1;
    else if (!words[i].startsWith("-") && firstPositional < 0) firstPositional = i;
  }
  if (!indexes.size && firstPositional >= 0) indexes.add(firstPositional);
  return indexes;
}

function patternIndexes(words) {
  const program = basename(words[0] ?? "");
  if (searchPrograms.has(program)) return searchPatterns(words, 1);
  if (program !== "git") return new Set();
  const sub = gitSubcommandIndex(words);
  if (sub >= 0 && words[sub] === "grep") return searchPatterns(words, sub + 1);
  const indexes = new Set();
  for (let i = sub + 1; i < words.length; i += 1) {
    if (gitPatternFlags.has(words[i])) indexes.add(i + 1);
  }
  return indexes;
}

function isSafe(words) {
  if (words[0] === "git") return safeGitSubcommands.has(gitSubcommand(words));
  return safeCommands.has(words[0]);
}

function envWord(word, cwd) {
  const pathLike = (value) =>
    value.includes("/") || value.startsWith(".") || existsSync(resolve(cwd, value));
  const candidates = word.includes("=") ? [word, word.slice(word.indexOf("=") + 1)] : [word];
  return candidates.find((value) => isEnvFile(value) && pathLike(value)) ?? null;
}

export function envAccess(commands) {
  for (const command of commands) {
    const redirected = [...command.writes, ...command.reads].find(isEnvFile);
    if (redirected) return redirected;
    if (isSafe(command.words)) continue;
    const patterns = patternIndexes(command.words);
    for (const [index, word] of command.words.entries()) {
      if (index === 0 || patterns.has(index)) continue;
      const found = envWord(word, command.cwd);
      if (found) return found;
    }
  }
  return null;
}

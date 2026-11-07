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
  let supplied = false;
  let firstPositional = -1;
  for (let i = start; i < words.length; i += 1) {
    const word = words[i];
    if (word === "--") {
      if (firstPositional < 0 && !supplied) firstPositional = i + 1;
      break;
    }
    if (searchPatternFlags.has(word)) {
      indexes.add(i + 1);
      supplied = true;
      i += 1;
    } else if (word.startsWith("--regexp=") || word.startsWith("--file=")) supplied = true;
    else if (word === "--file" || word === "-f") {
      supplied = true;
      i += 1;
    } else if (/^-[A-Za-z]+$/.test(word) && word.includes("e")) {
      supplied = true;
      if (word.endsWith("e")) {
        indexes.add(i + 1);
        i += 1;
      }
    } else if (/^-f./.test(word)) supplied = true;
    else if (searchValueFlags.has(word)) i += 1;
    else if (!word.startsWith("-") && firstPositional < 0) firstPositional = i;
  }
  if (!supplied && firstPositional >= 0) indexes.add(firstPositional);
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

const globCharacters = /[*?[]/;
const envSuffixes = [".env", ".envrc"];

function globRegExp(glob) {
  let source = "";
  for (let i = 0; i < glob.length; i += 1) {
    const character = glob[i];
    const close = character === "[" ? glob.indexOf("]", i + 2) : -1;
    if (character === "*") source += "[^/]*";
    else if (character === "?") source += "[^/]";
    else if (close > 0) {
      source += glob.slice(i, close + 1).replace(/\\/g, "\\\\");
      i = close;
    } else source += character.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${source}$`, "i");
}

function globMatchesEnv(word) {
  const name = word.replace(/\/+$/, "").split("/").pop();
  const first = name.search(globCharacters);
  if (first < 0 || [...name].every((character) => "*?[]".includes(character))) return false;
  const expression = globRegExp(name);
  const prefix = name.slice(0, first);
  return envSuffixes.some((suffix) =>
    [0, 1, 2, 3, 4, 5].some((cut) => {
      const candidate = prefix + suffix.slice(cut);
      return expression.test(candidate) && isEnvFile(candidate);
    }),
  );
}

function envWord(word, cwd) {
  const pathLike = (value) =>
    value.includes("/") ||
    value.startsWith(".") ||
    globCharacters.test(value) ||
    existsSync(resolve(cwd, value));
  const candidates = word.includes("=") ? [word, word.slice(word.indexOf("=") + 1)] : [word];
  return (
    candidates.find((value) => (isEnvFile(value) || globMatchesEnv(value)) && pathLike(value)) ??
    null
  );
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

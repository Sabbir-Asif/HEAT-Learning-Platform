import { existsSync, readdirSync, realpathSync } from "node:fs";
import { basename, join, resolve } from "node:path";

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

function globTokens(glob) {
  const tokens = [];
  for (let i = 0; i < glob.length; i += 1) {
    const character = glob[i];
    const close = character === "[" ? glob.indexOf("]", i + 2) : -1;
    if (character === "*") tokens.push({ kind: "star", source: "[^/]*" });
    else if (character === "?") tokens.push({ kind: "one", source: "[^/]" });
    else if (close > 0) {
      tokens.push({ kind: "one", source: glob.slice(i, close + 1).replace(/\\/g, "\\\\") });
      i = close;
    } else {
      tokens.push({
        kind: "literal",
        character,
        source: character.replace(/[.+^${}()|[\]\\]/g, "\\$&"),
      });
    }
  }
  return tokens;
}

function globRegExp(glob) {
  return new RegExp(
    `^${globTokens(glob)
      .map((token) => token.source)
      .join("")}$`,
    "i",
  );
}

const expansionCharacters = [...envSuffixes.join(""), ".", "x"];
const expansionLimit = 2000;

function minimalExpansions(name) {
  let names = [""];
  for (const token of globTokens(name)) {
    let options = [""];
    if (token.kind === "literal") options = [token.character];
    else if (token.kind === "one") {
      const expression = new RegExp(`^${token.source}$`, "i");
      options = expansionCharacters.filter((character) => expression.test(character));
    }
    if (names.length * options.length > expansionLimit) return null;
    names = names.flatMap((prefix) => options.map((option) => prefix + option));
  }
  return names;
}

function couldStartEnvName(prefix) {
  return prefix === "" || prefix === "." || prefix.toLowerCase().startsWith(".e");
}

function globMatchesEnvByName(name, first) {
  const expression = globRegExp(name);
  const prefix = name.slice(0, first);
  const dotfile =
    couldStartEnvName(prefix) &&
    envSuffixes.some((suffix) =>
      [0, 1, 2, 3, 4, 5].some((cut) => {
        const candidate = prefix + suffix.slice(cut);
        return expression.test(candidate) && isEnvFile(candidate);
      }),
    );
  if (dotfile) return true;
  const expansions = minimalExpansions(name);
  return expansions === null || expansions.some(isEnvFile);
}

function isEnvEntry(directory, entry) {
  if (isEnvFile(entry)) return true;
  try {
    return isEnvFile(realpathSync(join(directory, entry)));
  } catch {
    return false;
  }
}

function globMatchesEnvInDirectory(directory, name) {
  let entries;
  try {
    entries = readdirSync(directory);
  } catch {
    return null;
  }
  const expression = globRegExp(name);
  const dotted = name.startsWith(".");
  return entries.some(
    (entry) =>
      (dotted || !entry.startsWith(".")) && expression.test(entry) && isEnvEntry(directory, entry),
  );
}

function globMatchesEnv(word, cwd) {
  const trimmed = word.replace(/\/+$/, "");
  const name = trimmed.split("/").pop();
  const first = name.search(globCharacters);
  if (first < 0 || [...name].every((character) => "*?[]".includes(character))) return false;
  const directoryPart = trimmed.slice(0, trimmed.length - name.length);
  if (!globCharacters.test(directoryPart)) {
    const directory = directoryPart === "" ? cwd : resolve(cwd, directoryPart);
    const found = globMatchesEnvInDirectory(directory, name);
    if (found !== null) return found;
  }
  return globMatchesEnvByName(name, first);
}

function envWord(word, cwd) {
  const pathLike = (value) =>
    value.includes("/") ||
    value.startsWith(".") ||
    globCharacters.test(value) ||
    existsSync(resolve(cwd, value));
  const candidates = word.includes("=") ? [word, word.slice(word.indexOf("=") + 1)] : [word];
  return (
    candidates.find(
      (value) => (isEnvFile(value) || globMatchesEnv(value, cwd)) && pathLike(value),
    ) ?? null
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

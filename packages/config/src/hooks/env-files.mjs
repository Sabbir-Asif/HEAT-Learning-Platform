import { existsSync, lstatSync, readdirSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { isStraightLine } from "./shell.mjs";

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

const posixClasses = {
  alpha: "a-zA-Z",
  digit: "0-9",
  alnum: "a-zA-Z0-9",
  upper: "A-Z",
  lower: "a-z",
  space: "\\s",
  blank: " \\t",
  punct: "!-\\/:-@\\[-`{-~",
  xdigit: "0-9A-Fa-f",
  word: "\\w",
  cntrl: "\\x00-\\x1f\\x7f",
  print: " -~",
  graph: "!-~",
};

const escapeCharacter = (character) => character.replace(/[.+^${}()|[\]\\*?/-]/g, "\\$&");

function bracketExpression(glob, start) {
  let at = start + 1;
  let negate = false;
  if (glob[at] === "!" || glob[at] === "^") {
    negate = true;
    at += 1;
  }
  let body = "";
  let first = true;
  while (at < glob.length) {
    const character = glob[at];
    if (character === "]" && !first) {
      return { source: `[${negate ? "^" : ""}${body}]`, end: at };
    }
    first = false;
    const close = character === "[" && glob[at + 1] === ":" ? glob.indexOf(":]", at + 2) : -1;
    const className = close > 0 ? glob.slice(at + 2, close) : "";
    if (Object.hasOwn(posixClasses, className)) {
      body += posixClasses[className];
      at = close + 2;
    } else if (character === "\\" && at + 1 < glob.length) {
      body += escapeCharacter(glob[at + 1]);
      at += 2;
    } else {
      body += /[\\\][^]/.test(character) ? `\\${character}` : character;
      at += 1;
    }
  }
  return null;
}

function globRegExp(glob) {
  let source = "";
  for (let i = 0; i < glob.length; i += 1) {
    const character = glob[i];
    const bracket = character === "[" ? bracketExpression(glob, i) : null;
    if (character === "*") source += "[^/]*";
    else if (character === "?") source += "[^/]";
    else if (bracket) {
      source += bracket.source;
      i = bracket.end;
    } else if (character === "\\" && i + 1 < glob.length) {
      source += escapeCharacter(glob[i + 1]);
      i += 1;
    } else source += escapeCharacter(character);
  }
  try {
    return new RegExp(`^${source}$`, "i");
  } catch {
    return /^[^/]*$/;
  }
}

const braceLimit = 256;

function braceAlternatives(body) {
  const parts = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < body.length; i += 1) {
    if (body[i] === "{") depth += 1;
    else if (body[i] === "}") depth -= 1;
    else if (body[i] === "," && depth === 0) {
      parts.push(body.slice(from, i));
      from = i + 1;
    }
  }
  parts.push(body.slice(from));
  if (parts.length > 1) return parts;
  const range = /^(?:(-?\d+)\.\.(-?\d+)|([A-Za-z])\.\.([A-Za-z]))(?:\.\.-?\d+)?$/.exec(body);
  if (!range) return null;
  const [low, high] = range[1]
    ? [Number(range[1]), Number(range[2])]
    : [range[3].charCodeAt(0), range[4].charCodeAt(0)];
  if (Math.abs(high - low) > braceLimit) return Array.from({ length: braceLimit + 1 }, () => "");
  const step = low <= high ? 1 : -1;
  const values = [];
  for (let n = low; n !== high + step; n += step)
    values.push(range[1] ? String(n) : String.fromCharCode(n));
  return values;
}

function findBrace(word) {
  for (let open = word.indexOf("{"); open >= 0; open = word.indexOf("{", open + 1)) {
    if (word[open - 1] === "$") continue;
    let depth = 0;
    for (let close = open; close < word.length; close += 1) {
      if (word[close] === "{") depth += 1;
      else if (word[close] === "}" && --depth === 0) {
        const parts = braceAlternatives(word.slice(open + 1, close));
        if (parts) return { open, close, parts };
        break;
      }
    }
  }
  return null;
}

function expandBraces(word) {
  const results = [];
  const pending = [word];
  while (pending.length) {
    if (results.length + pending.length > braceLimit) return null;
    const current = pending.pop();
    const brace = findBrace(current);
    if (!brace) results.push(current);
    else {
      for (const part of brace.parts) {
        pending.push(current.slice(0, brace.open) + part + current.slice(brace.close + 1));
      }
    }
  }
  return results;
}

function globMatchesEnvByName(name) {
  const expression = globRegExp(name);
  const prefix = name.slice(0, name.search(globCharacters));
  return envSuffixes.some((suffix) =>
    [0, 1, 2, 3, 4, 5].some((cut) => {
      const candidate = prefix + suffix.slice(cut);
      return expression.test(candidate) && isEnvFile(candidate);
    }),
  );
}

function isEnvEntry(directory, entry) {
  if (isEnvFile(entry)) return true;
  try {
    return isEnvFile(realpathSync(join(directory, entry)));
  } catch {
    return false;
  }
}

function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function realOrNull(path) {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
}

function descend(base, segment) {
  if (segment === ".") return [base];
  if (segment === "..") {
    return base.linked ? null : [{ path: resolve(base.path, ".."), linked: false }];
  }
  const path = join(base.path, segment);
  const real = realOrNull(path);
  return [{ path: real ?? path, linked: base.linked || (real !== null && real !== path) }];
}

function matchingDirectories(base, segment) {
  let entries;
  try {
    entries = readdirSync(base.path);
  } catch {
    return null;
  }
  const expression = globRegExp(segment);
  const found = [];
  for (const entry of entries) {
    const path = join(base.path, entry);
    if (!expression.test(entry) || !isDirectory(path)) continue;
    let symlink;
    try {
      symlink = lstatSync(path).isSymbolicLink();
    } catch {
      symlink = true;
    }
    found.push({ path: realOrNull(path) ?? path, linked: base.linked || symlink });
  }
  return found;
}

function listDirectories(directoryPart, context) {
  if (/[$`]/.test(directoryPart)) return null;
  const segments = directoryPart.split("/").filter((segment) => segment !== "");
  let start;
  if (directoryPart.startsWith("/")) start = "/";
  else if (directoryPart.startsWith("~/")) {
    start = homedir();
    segments.shift();
  } else start = context.cwd;
  if (segments.some((segment) => segment.startsWith("~"))) return null;
  const root = realOrNull(start);
  if (root === null) return null;
  let bases = [{ path: root, linked: false }];
  for (const segment of segments) {
    const next = [];
    for (const base of bases) {
      const found = globCharacters.test(segment)
        ? matchingDirectories(base, segment)
        : descend(base, segment);
      if (found === null) return null;
      next.push(...found);
    }
    bases = next;
    if (bases.length > braceLimit) return null;
  }
  return bases.map((base) => base.path);
}

function directoryHasEnvMatch(directory, expression) {
  let entries;
  try {
    entries = readdirSync(directory);
  } catch {
    return null;
  }
  return entries.some((entry) => expression.test(entry) && isEnvEntry(directory, entry));
}

function globMatchesEnv(word, context) {
  const trimmed = word.replace(/\/+$/, "");
  const name = trimmed.split("/").pop();
  if (!globCharacters.test(name)) return false;
  const directories =
    context.listing && !trimmed.includes("**")
      ? listDirectories(trimmed.slice(0, trimmed.length - name.length), context)
      : null;
  if (directories === null) {
    return (
      ![...name].every((character) => "*?[]".includes(character)) && globMatchesEnvByName(name)
    );
  }
  const expression = globRegExp(name);
  let unreadable = false;
  for (const directory of directories) {
    const found = directoryHasEnvMatch(directory, expression);
    if (found) return true;
    if (found === null) unreadable = true;
  }
  return unreadable ? globMatchesEnvByName(name) : false;
}

function envVariant(word, context) {
  const pathLike = (value) =>
    value.includes("/") ||
    value.startsWith(".") ||
    globCharacters.test(value) ||
    existsSync(resolve(context.cwd, value));
  const candidates = word.includes("=") ? [word, word.slice(word.indexOf("=") + 1)] : [word];
  return (
    candidates.find(
      (value) => (isEnvFile(value) || globMatchesEnv(value, context)) && pathLike(value),
    ) ?? null
  );
}

function envWord(word, context) {
  const variants = expandBraces(word);
  if (variants === null) return word;
  for (const variant of variants) {
    const found = envVariant(variant, context);
    if (found) return found;
  }
  return null;
}

const fileReaders = new Set([
  "cat",
  "head",
  "tail",
  "less",
  "more",
  "bat",
  "nl",
  "tac",
  "wc",
  "strings",
  "xxd",
  "od",
  "hexdump",
  "rev",
  "fold",
  "cut",
  "sort",
  "uniq",
  "base64",
  "md5sum",
  "shasum",
  "sha256sum",
  "cksum",
  "file",
  "diff",
  "cmp",
  "paste",
  "column",
  "grep",
  "egrep",
  "fgrep",
]);
const writerPrograms = new Set([
  "tar",
  "bsdtar",
  "unzip",
  "gunzip",
  "bunzip2",
  "7z",
  "7za",
  "cp",
  "mv",
  "touch",
  "tee",
  "install",
  "dd",
  "rsync",
  "ln",
  "curl",
  "wget",
  "patch",
  "truncate",
  "node",
  "python",
  "python3",
  "ruby",
  "perl",
  "php",
  "deno",
  "bun",
]);
const writerGitSubcommands = new Set([
  "checkout",
  "restore",
  "switch",
  "reset",
  "stash",
  "apply",
  "am",
  "merge",
  "pull",
  "clone",
  "cherry-pick",
  "rebase",
  "clean",
  "worktree",
  "mv",
]);
const recursiveFlag =
  /^(?:-[A-Za-z]*[rRdN][A-Za-z]*|-d.*|--recursive|--dereference-recursive|--directories(?:=.*)?|--new-file)$/;

const recursiveReaders = new Set(["grep", "egrep", "fgrep", "diff"]);

function isFileReader(command) {
  const program = basename(command.words[0] ?? "");
  if (!fileReaders.has(program)) return false;
  return !(recursiveReaders.has(program) && command.words.some((w) => recursiveFlag.test(w)));
}

function isWriter(command) {
  const program = basename(command.words[0] ?? "");
  if (command.writes.some((target) => !target.startsWith("/dev/"))) return true;
  if (writerPrograms.has(program)) return true;
  if (["sed", "perl"].includes(program) && command.words.some((w) => /^-[A-Za-z]*i/.test(w))) {
    return true;
  }
  return program === "git" && writerGitSubcommands.has(gitSubcommand(command.words));
}

const directoryCommands = new Set(["cd", "pushd", "popd"]);

function listingTrusted(commands, text) {
  if (!isStraightLine(commands, text)) return false;
  if (/CDPATH|(?<![\w./-])(?:cd|pushd|popd)(?![\w./-])/.test(text)) return false;
  return !commands.some((command) => directoryCommands.has(basename(command.words[0] ?? "")));
}

export function envAccess(commands, text = "") {
  const trusted = listingTrusted(commands, text) && !commands.some(isWriter);
  for (const command of commands) {
    const redirected = [...command.writes, ...command.reads].find(isEnvFile);
    if (redirected) return redirected;
    if (isSafe(command.words)) continue;
    const context = { cwd: command.cwd, listing: trusted && isFileReader(command) };
    const patterns = patternIndexes(command.words);
    for (const [index, word] of command.words.entries()) {
      if (index === 0 || patterns.has(index)) continue;
      const found = envWord(word, context);
      if (found) return found;
    }
  }
  return null;
}

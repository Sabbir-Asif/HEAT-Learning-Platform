import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

const assignment = /^[A-Za-z_][A-Za-z0-9_]*=/;
const keywords = new Set([
  "if",
  "then",
  "else",
  "elif",
  "fi",
  "do",
  "done",
  "while",
  "until",
  "{",
  "}",
  "!",
  "time",
  "command",
  "builtin",
  "exec",
]);
const wrappers = new Set(["env", "sudo", "nohup", "nice", "stdbuf", "timeout", "xargs"]);
const shells = new Set(["bash", "sh", "zsh", "dash", "ksh"]);
const numeric = /^[-+]?\d+[smhd]?$/;
const separators = new Set([";", "|", "&", "(", ")"]);
const wordEnd = new Set([" ", "\t", "\n", ";", "|", "&", "(", ")", "<", ">"]);

function skipDoubleQuoted(text, start) {
  let i = start;
  while (i < text.length && text[i] !== '"') i += text[i] === "\\" ? 2 : 1;
  return Math.min(i + 1, text.length);
}

function findClose(text, start, open, close) {
  let depth = 1;
  let i = start;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\") i += 2;
    else if (ch === "'") {
      const end = text.indexOf("'", i + 1);
      i = end === -1 ? text.length : end + 1;
    } else if (ch === '"') i = skipDoubleQuoted(text, i + 1);
    else {
      if (ch === open) depth += 1;
      else if (ch === close && --depth === 0) return i;
      i += 1;
    }
  }
  return text.length;
}

function expandHome(path) {
  if (path === "~") return homedir();
  return path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
}

function stripWrappers(words) {
  let i = 0;
  const skipped = [];
  let wrapped = false;
  while (i < words.length) {
    const word = words[i];
    if (assignment.test(word)) i += 1;
    else if (keywords.has(word)) {
      skipped.push(word);
      i += 1;
    } else if (wrappers.has(word)) {
      wrapped = true;
      i += 1;
      while (i < words.length && words[i].startsWith("-")) i += 1;
      if (["nice", "timeout"].includes(word) && numeric.test(words[i] ?? "")) i += 1;
    } else break;
  }
  return { words: words.slice(i), keywords: skipped, wrapped };
}

function embeddedScript(words) {
  if (words[0] === "eval") return words.slice(1).join(" ");
  if (!shells.has(basename(words[0] ?? ""))) return null;
  for (let i = 1; i < words.length && words[i].startsWith("-"); i += 1) {
    if (/^-[a-zA-Z]*c[a-zA-Z]*$/.test(words[i])) return words[i + 1] ?? null;
  }
  return null;
}

function scan(text, startCwd, out) {
  let cwd = startCwd;
  let words = [];
  let writes = [];
  let reads = [];
  const heredocs = [];
  const groups = [];
  const length = text.length;

  const finish = () => {
    const stripped = stripWrappers(words);
    const normalized = stripped.words;
    if (normalized.length || writes.length || reads.length) {
      out.push({
        words: normalized,
        cwd,
        writes,
        reads,
        keywords: stripped.keywords,
        wrapped: stripped.wrapped,
      });
      const script = embeddedScript(normalized);
      if (script) scan(script, cwd, out);
      if (["cd", "pushd"].includes(normalized[0])) {
        const target = normalized.slice(1).find((word) => !word.startsWith("-"));
        cwd = resolve(cwd, expandHome(target ?? "~"));
      }
    }
    words = [];
    writes = [];
    reads = [];
  };

  const skipBlanks = (at) => {
    let i = at;
    while (text[i] === " " || text[i] === "\t") i += 1;
    return i;
  };

  const nested = (inner) => scan(inner, cwd, out);

  const scanExpansions = (body) => {
    let i = 0;
    while (i < body.length) {
      if (body[i] === "\\") i += 2;
      else if (body.startsWith("$(", i)) {
        const close = findClose(body, i + 2, "(", ")");
        nested(body.slice(i + 2, close));
        i = close + 1;
      } else if (body.startsWith("${", i)) {
        const close = findClose(body, i + 2, "{", "}");
        scanExpansions(body.slice(i + 2, close));
        i = close + 1;
      } else if (body[i] === "`") {
        let close = i + 1;
        while (close < body.length && body[close] !== "`") close += body[close] === "\\" ? 2 : 1;
        nested(body.slice(i + 1, close));
        i = close + 1;
      } else i += 1;
    }
  };

  const readWord = (at) => {
    let word = "";
    let i = at;
    while (i < length && !wordEnd.has(text[i])) {
      const ch = text[i];
      if (ch === "\\") {
        if (text[i + 1] !== "\n") word += text[i + 1] ?? "";
        i += 2;
      } else if (ch === "'") {
        const end = text.indexOf("'", i + 1);
        const stop = end === -1 ? length : end;
        word += text.slice(i + 1, stop);
        i = stop + 1;
      } else if (ch === '"') {
        i += 1;
        while (i < length && text[i] !== '"') {
          if (text[i] === "\\" && '"\\$`'.includes(text[i + 1] ?? "")) {
            word += text[i + 1];
            i += 2;
          } else if (text.startsWith("$(", i)) {
            const close = findClose(text, i + 2, "(", ")");
            nested(text.slice(i + 2, close));
            word += text.slice(i, close + 1);
            i = close + 1;
          } else if (text[i] === "`") {
            const close = text.indexOf("`", i + 1);
            const stop = close === -1 ? length : close;
            nested(text.slice(i + 1, stop));
            word += text.slice(i, stop + 1);
            i = stop + 1;
          } else {
            word += text[i];
            i += 1;
          }
        }
        i += 1;
      } else if (text.startsWith("$(", i)) {
        const close = findClose(text, i + 2, "(", ")");
        nested(text.slice(i + 2, close));
        word += text.slice(i, close + 1);
        i = close + 1;
      } else if (text.startsWith("${", i)) {
        const close = findClose(text, i + 2, "{", "}");
        scanExpansions(text.slice(i + 2, close));
        word += text.slice(i, close + 1);
        i = close + 1;
      } else if (ch === "`") {
        const close = text.indexOf("`", i + 1);
        const stop = close === -1 ? length : close;
        nested(text.slice(i + 1, stop));
        word += text.slice(i, stop + 1);
        i = stop + 1;
      } else {
        word += ch;
        i += 1;
      }
    }
    return [word, i];
  };

  const capture = (at, list) => {
    const i = skipBlanks(at);
    if (i >= length || separators.has(text[i]) || text[i] === "\n") return i;
    if (text[i] === "(") {
      const close = findClose(text, i + 1, "(", ")");
      nested(text.slice(i + 1, close));
      return close + 1;
    }
    const [word, next] = readWord(i);
    list.push(word);
    return next;
  };

  const redirect = (at) => {
    const ch = text[at];
    let i = at + 1;
    if (ch === ">") {
      if (text[i] === ">" || text[i] === "|") i += 1;
      else if (text[i] === "&") {
        const duplicate = /^&(\d+|-)/.exec(text.slice(i));
        if (duplicate) return i + duplicate[0].length;
        i += 1;
      }
      return capture(i, writes);
    }
    if (text.startsWith("<<<", at)) return capture(at + 3, []);
    if (text.startsWith("<<", at)) {
      i = at + 2;
      const strip = text[i] === "-";
      if (strip) i += 1;
      const begin = skipBlanks(i);
      const [delimiter, next] = readWord(begin);
      heredocs.push({ delimiter, strip, quoted: /['"\\]/.test(text.slice(begin, next)) });
      return next;
    }
    if (text[i] === "&") {
      const duplicate = /^&(\d+|-)/.exec(text.slice(i));
      if (duplicate) return i + duplicate[0].length;
    }
    if (text[i] === ">") i += 1;
    return capture(i, reads);
  };

  const skipHeredocBodies = (at) => {
    let i = at;
    for (const { delimiter, strip, quoted } of heredocs.splice(0)) {
      const body = [];
      while (i < length) {
        const end = text.indexOf("\n", i);
        const stop = end === -1 ? length : end;
        const line = text.slice(i, stop);
        i = stop + 1;
        if ((strip ? line.replace(/^\t+/, "") : line) === delimiter) break;
        body.push(line);
      }
      if (!quoted) scanExpansions(body.join("\n"));
    }
    return Math.min(i, length);
  };

  let i = 0;
  while (i < length) {
    const ch = text[i];
    if (ch === " " || ch === "\t") i += 1;
    else if (ch === "\\" && text[i + 1] === "\n") i += 2;
    else if (ch === "#") {
      const end = text.indexOf("\n", i);
      i = end === -1 ? length : end;
    } else if (ch === "\n") {
      finish();
      i = skipHeredocBodies(i + 1);
    } else if (ch === "&" && text[i + 1] === ">") {
      i += text[i + 2] === ">" ? 3 : 2;
      i = capture(i, writes);
    } else if (separators.has(ch)) {
      finish();
      if (ch === "(") groups.push(cwd);
      else if (ch === ")") cwd = groups.pop() ?? cwd;
      i += 1;
    } else if (ch === ">" || ch === "<") i = redirect(i);
    else {
      const [word, next] = readWord(i);
      if (/^\d+$/.test(word) && (text[next] === ">" || text[next] === "<")) i = next;
      else {
        words.push(word);
        i = next;
      }
    }
  }
  finish();
}

export function parseShell(text, cwd) {
  const commands = [];
  scan(text, cwd, commands);
  return commands;
}

const structuralPrograms = new Set([
  "bash",
  "sh",
  "zsh",
  "dash",
  "ksh",
  "eval",
  "source",
  ".",
  "trap",
  "case",
  "esac",
  "function",
  "select",
  "coproc",
]);

export function isStraightLine(commands, text) {
  const scanned = text.replace(/\$\{[A-Za-z_]\w*\}/g, "").replace(/[0-9]*>&[0-9-]*|&>>?|>\|/g, "");
  if (/[&|(){}`]/.test(scanned)) return false;
  return commands.every((command) => {
    const program = command.words[0] ?? "";
    return (
      !command.wrapped &&
      command.keywords.every((keyword) => keyword === "do" || keyword === "done") &&
      !structuralPrograms.has(basename(program)) &&
      !/[$`]/.test(program)
    );
  });
}

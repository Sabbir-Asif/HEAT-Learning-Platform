import { basename, resolve } from "node:path";

const globalOptionsWithValue = new Set(["-c", "--git-dir", "--work-tree", "--namespace"]);

export function gitInvocation(command) {
  const { words } = command;
  if (basename(words[0] ?? "") !== "git") return null;
  let cwd = command.cwd;
  let i = 1;
  while (i < words.length && words[i].startsWith("-")) {
    if (words[i] === "-C") {
      cwd = resolve(cwd, words[i + 1] ?? ".");
      i += 2;
    } else i += globalOptionsWithValue.has(words[i]) ? 2 : 1;
  }
  return { sub: words[i] ?? null, args: words.slice(i + 1), cwd };
}

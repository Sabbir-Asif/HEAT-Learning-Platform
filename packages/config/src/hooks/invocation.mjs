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

const ghValueFlags = new Set([
  "-R",
  "--repo",
  "-X",
  "--method",
  "-H",
  "--header",
  "-f",
  "-F",
  "--field",
  "--raw-field",
  "--input",
  "-q",
  "--jq",
  "-t",
  "--template",
  "--cache",
  "--hostname",
  "-b",
  "--body",
  "-B",
  "--base",
  "--title",
  "--body-file",
  "--head",
  "--label",
  "--assignee",
  "--reviewer",
  "--milestone",
  "--project",
]);
const fieldFlags = new Set(["-f", "-F", "--field", "--raw-field", "--input"]);

export function ghInvocation(command) {
  const { words } = command;
  if (basename(words[0] ?? "") !== "gh") return null;
  const positional = [];
  let method = null;
  let head = null;
  let hasFields = false;
  for (let i = 1; i < words.length; i += 1) {
    const word = words[i];
    const inline = word.startsWith("--") ? word.indexOf("=") : -1;
    const name = inline > 0 ? word.slice(0, inline) : word;
    const value = inline > 0 ? word.slice(inline + 1) : null;
    if (!word.startsWith("-")) positional.push(word);
    else {
      const consumed = value === null && ghValueFlags.has(name) ? words[i + 1] : value;
      if (value === null && ghValueFlags.has(name)) i += 1;
      if (name === "-X" || name === "--method") method = consumed ?? null;
      if (name === "--head" || (name === "-H" && positional[0] === "pr")) head = consumed ?? null;
      if (fieldFlags.has(name)) hasFields = true;
    }
  }
  return {
    positional,
    method,
    head,
    hasFields,
    mentionsPullRequestMutation: words.some((word) => word.includes("createPullRequest")),
    cwd: command.cwd,
  };
}

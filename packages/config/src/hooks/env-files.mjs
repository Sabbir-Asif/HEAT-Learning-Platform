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

function gitSubcommand(words) {
  for (let i = 1; i < words.length; i += 1) {
    if (["-C", "-c", "--git-dir", "--work-tree"].includes(words[i])) i += 1;
    else if (!words[i].startsWith("-")) return words[i];
  }
  return null;
}

function isSafe(words) {
  if (words[0] === "git") return safeGitSubcommands.has(gitSubcommand(words));
  return safeCommands.has(words[0]);
}

export function envAccess(commands) {
  for (const command of commands) {
    const redirected = [...command.writes, ...command.reads].find(isEnvFile);
    if (redirected) return redirected;
    if (isSafe(command.words)) continue;
    for (const word of command.words.slice(1)) {
      const value = word.includes("=") ? word.slice(word.indexOf("=") + 1) : word;
      if (isEnvFile(word)) return word;
      if (isEnvFile(value)) return value;
    }
  }
  return null;
}

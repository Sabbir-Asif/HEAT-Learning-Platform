import { envAccess, isEnvFile } from "./env-files.mjs";
import { parseShell } from "./shell.mjs";

const fileTools = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

const envDenial = (path) =>
  `Access to environment files is denied: ${path}. They hold secrets; ask the owner for the value you need instead.`;

function firstEnvPath(paths) {
  return paths.find((path) => typeof path === "string" && isEnvFile(path)) ?? null;
}

function checkBash(input) {
  const command = input.tool_input?.command;
  if (typeof command !== "string") throw new Error("Bash input has no command");
  const commands = parseShell(command, input.cwd || process.cwd());
  const envPath = envAccess(commands);
  return envPath ? { deny: envDenial(envPath) } : {};
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

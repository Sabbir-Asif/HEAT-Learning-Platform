import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";

function expandHome(path) {
  if (path === "~") return homedir();
  return path.startsWith(`~${sep}`) ? join(homedir(), path.slice(2)) : path;
}

export function resolveReal(path, base = process.cwd()) {
  const expanded = expandHome(path);
  const absolute = isAbsolute(expanded) ? expanded : resolve(base, expanded);
  let current = sep;
  for (const segment of absolute.split(sep)) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      current = dirname(current);
      continue;
    }
    const next = join(current, segment);
    try {
      current = realpathSync(next);
    } catch {
      current = next;
    }
  }
  return current;
}

import { execFileSync } from "node:child_process";

export const MIGRATIONS_DIR = "packages/db/prisma/migrations";

const STATUS = { D: "deleted" };

export const statusName = (code) => STATUS[code[0]] ?? "modified";

export function changedMigrationFiles({ cwd, base }) {
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8" });
  const mergeBase = git("merge-base", base, "HEAD").trim();
  const existing = new Set(
    git("ls-tree", "-r", "--name-only", mergeBase, "--", MIGRATIONS_DIR)
      .split("\n")
      .filter(Boolean)
      .map((path) => path.split("/")[4])
      .filter((entry) => entry !== undefined && entry !== "migration_lock.toml"),
  );
  const changed = git(
    "diff",
    "--name-status",
    "--no-renames",
    mergeBase,
    "HEAD",
    "--",
    MIGRATIONS_DIR,
  )
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [code, path] = line.split("\t");
      return { status: statusName(code), path };
    });
  return changed.filter(({ path }) => existing.has(path.split("/")[4]));
}

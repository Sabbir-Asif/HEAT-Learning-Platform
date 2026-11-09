import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { changedMigrationFiles, statusName } from "../src/migrations.mjs";

const migrations = "packages/db/prisma/migrations";
const bin = resolve(import.meta.dirname, "../bin/migrations.mjs");
let repo;

const git = (...args) =>
  execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
const write = (path, text) => {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), text);
};
const commit = (message) => {
  git("add", "-A");
  git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", message);
};

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "heat-migrations-"));
  git("init", "-q", "-b", "main");
  write(`${migrations}/migration_lock.toml`, 'provider = "postgresql"\n');
  write(`${migrations}/20260101000000_init/migration.sql`, "create table a (id int);\n");
  write(`${migrations}/20260102000000_more/migration.sql`, "create table b (id int);\n");
  write("README.md", "x\n");
  commit("base");
  git("switch", "-q", "-c", "feature");
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("statusName", () => {
  test("maps known codes and treats unknown ones as modified", () => {
    expect(statusName("D")).toBe("deleted");
    expect(statusName("M")).toBe("modified");
    expect(statusName("U")).toBe("modified");
  });
});

describe("changedMigrationFiles", () => {
  test("a new migration directory is allowed", () => {
    write(`${migrations}/20260103000000_new/migration.sql`, "select 1;\n");
    commit("add");
    expect(changedMigrationFiles({ cwd: repo, base: "main" })).toEqual([]);
  });

  test("an edited migration is reported with its path", () => {
    write(`${migrations}/20260101000000_init/migration.sql`, "create table a (id bigint);\n");
    commit("edit");
    expect(changedMigrationFiles({ cwd: repo, base: "main" })).toEqual([
      { status: "modified", path: `${migrations}/20260101000000_init/migration.sql` },
    ]);
  });

  test("a deleted migration is reported", () => {
    git("rm", "-q", "-r", `${migrations}/20260102000000_more`);
    commit("delete");
    expect(changedMigrationFiles({ cwd: repo, base: "main" })).toEqual([
      { status: "deleted", path: `${migrations}/20260102000000_more/migration.sql` },
    ]);
  });

  test("a renamed migration directory counts as deleted", () => {
    git("mv", `${migrations}/20260102000000_more`, `${migrations}/20260102000000_renamed`);
    commit("rename");
    expect(changedMigrationFiles({ cwd: repo, base: "main" })).toEqual([
      { status: "deleted", path: `${migrations}/20260102000000_more/migration.sql` },
    ]);
  });

  test("a file added to an existing migration directory is reported", () => {
    write(`${migrations}/20260101000000_init/extra.sql`, "select 1;\n");
    commit("add file");
    expect(changedMigrationFiles({ cwd: repo, base: "main" })).toEqual([
      { status: "modified", path: `${migrations}/20260101000000_init/extra.sql` },
    ]);
  });

  test("changes outside migrations and to the lock file are ignored", () => {
    write("README.md", "y\n");
    write(`${migrations}/migration_lock.toml`, 'provider = "postgresql"\n# x\n');
    commit("other");
    expect(changedMigrationFiles({ cwd: repo, base: "main" })).toEqual([]);
  });

  test("compares against the merge base, so later work on the base is not a change", () => {
    git("switch", "-q", "main");
    write(`${migrations}/20260104000000_other/migration.sql`, "select 2;\n");
    commit("main moves on");
    git("switch", "-q", "feature");
    write("README.md", "z\n");
    commit("feature work");
    expect(changedMigrationFiles({ cwd: repo, base: "main" })).toEqual([]);
  });
});

describe("migrations bin", () => {
  const run = (...args) => spawnSync("node", [bin, ...args], { cwd: repo, encoding: "utf8" });

  test("passes and says so when nothing changed", () => {
    const result = run("immutable", "main");
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/unchanged/);
  });

  test("fails and names the edited file", () => {
    write(`${migrations}/20260101000000_init/migration.sql`, "create table a (id bigint);\n");
    commit("edit");
    const result = run("immutable", "main");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`${migrations}/20260101000000_init/migration.sql`);
    expect(result.stderr).toMatch(/modified/);
  });

  test("fails without a base ref", () => {
    expect(run("immutable").status).toBe(1);
  });
});

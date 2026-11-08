import { mkdirSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, test } from "vitest";
import { resolveReal } from "../../src/hooks/paths.mjs";
import { cleanupAll, tempDir } from "../fixtures/repo.mjs";

afterAll(cleanupAll);

test("resolves directories that do not exist yet under the real path of their ancestor", () => {
  const dir = tempDir("paths");
  expect(resolveReal(join(dir, "a/b/c.txt"))).toBe(join(dir, "a/b/c.txt"));
});

test("resolves symlinks before applying .. segments", () => {
  const dir = tempDir("paths");
  mkdirSync(join(dir, "real/inner"), { recursive: true });
  symlinkSync(join(dir, "real/inner"), join(dir, "link"));
  expect(resolveReal(`${dir}/link/../file.txt`)).toBe(join(dir, "real/file.txt"));
});

test("resolves relative paths against the base and expands the home directory", () => {
  const dir = tempDir("paths");
  expect(resolveReal("x/./y/../z", dir)).toBe(join(dir, "x/z"));
  expect(resolveReal("~/.claude/note.md")).toBe(join(resolveReal(homedir()), ".claude/note.md"));
});

test("maps /tmp style aliases to their real location", () => {
  const dir = tempDir("paths");
  const alias = process.platform === "darwin" ? dir.replace(/^\/private/, "") : dir;
  expect(resolveReal(join(alias, "f.txt"))).toBe(join(dir, "f.txt"));
});

test("keeps a dangling symlink as written", () => {
  const dir = tempDir("paths");
  symlinkSync(join(dir, "nowhere"), join(dir, "dangling"));
  expect(resolveReal(join(dir, "dangling"))).toBe(join(dir, "dangling"));
});

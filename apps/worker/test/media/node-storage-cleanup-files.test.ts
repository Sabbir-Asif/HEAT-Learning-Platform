import { mkdtemp, mkdir, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { NodeStorageCleanupFiles } from "../../src/media/node-storage-cleanup-files";

let root: string;
let outside: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "cleanup-root-"));
  outside = await mkdtemp(join(tmpdir(), "cleanup-outside-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
});

describe("NodeStorageCleanupFiles", () => {
  test("refuses paths outside its directories", async () => {
    const files = new NodeStorageCleanupFiles([root]);
    await writeFile(join(outside, "keep.txt"), "x");

    await expect(files.remove(join(outside, "keep.txt"))).rejects.toThrow();
    await expect(files.remove(join(root, "..", "x"))).rejects.toThrow();
    await expect(files.remove(root)).rejects.toThrow();
    expect(await readdir(outside)).toEqual(["keep.txt"]);
  });

  test("removing a symlink does not touch its target", async () => {
    const files = new NodeStorageCleanupFiles([root]);
    await writeFile(join(outside, "keep.txt"), "x");
    await symlink(outside, join(root, "link"));

    await files.remove(join(root, "link"));

    expect(await readdir(outside)).toEqual(["keep.txt"]);
    expect(await readdir(root)).toEqual([]);
  });

  test("sums directory sizes without following symlinks and lists entries", async () => {
    const files = new NodeStorageCleanupFiles([root]);
    await mkdir(join(root, "dir"));
    await writeFile(join(root, "dir", "a.bin"), "12345");
    await writeFile(join(outside, "big.bin"), "1234567890");
    await symlink(outside, join(root, "dir", "link"));

    expect(await files.sizeOf(join(root, "dir"))).toBe(5);
    const entries = await files.list(root);
    expect(entries.map((entry) => [entry.name, entry.isDirectory])).toEqual([["dir", true]]);
    expect(await files.list(join(root, "missing"))).toEqual([]);
  });

  test("reads a file as text and answers null for a missing file or a directory", async () => {
    const files = new NodeStorageCleanupFiles([root]);
    await writeFile(join(root, "note.txt"), "hello");
    await mkdir(join(root, "dir"));

    expect(await files.readText(join(root, "note.txt"))).toBe("hello");
    expect(await files.readText(join(root, "missing.txt"))).toBeNull();
    expect(await files.readText(join(root, "dir"))).toBeNull();
    await expect(files.readText(join(outside, "note.txt"))).rejects.toThrow();
  });
});

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { NodeHlsFilesystem } from "../../src/transcode/hls-filesystem";

describe("NodeHlsFilesystem", () => {
  let root: string;
  const filesystem = new NodeHlsFilesystem();

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "heat-hls-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("writes, reads and checks files inside new directories", async () => {
    await filesystem.makeDirectory(join(root, "a", "b"));
    await filesystem.writeText(join(root, "a", "b", "x.txt"), "hello");
    expect(await filesystem.readText(join(root, "a", "b", "x.txt"))).toBe("hello");
    expect(await filesystem.exists(join(root, "a", "b", "x.txt"))).toBe(true);
  });

  test("reports a missing file as null and not existing", async () => {
    expect(await filesystem.readText(join(root, "none"))).toBeNull();
    expect(await filesystem.exists(join(root, "none"))).toBe(false);
  });

  test("renames a directory and removes it with its contents", async () => {
    await filesystem.makeDirectory(join(root, "from"));
    await filesystem.writeText(join(root, "from", "f"), "1");
    await filesystem.rename(join(root, "from"), join(root, "to"));
    expect(await filesystem.exists(join(root, "from"))).toBe(false);
    expect(await filesystem.readText(join(root, "to", "f"))).toBe("1");
    await filesystem.remove(join(root, "to"));
    expect(await filesystem.exists(join(root, "to"))).toBe(false);
    await expect(filesystem.remove(join(root, "to"))).resolves.toBeUndefined();
  });

  test("rethrows an error that is not a missing file", async () => {
    await filesystem.writeText(join(root, "file"), "1");
    await expect(filesystem.readText(join(root, "file", "child"))).rejects.toThrow();
    await expect(filesystem.exists(join(root, "file", "child"))).rejects.toThrow();
  });
});

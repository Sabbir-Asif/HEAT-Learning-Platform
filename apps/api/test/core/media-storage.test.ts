import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { LocalMediaStorage, isMediaFileName, isMediaKey } from "../../src/core/media-storage";

const key = "public/2026/11/0194f3a0-0000-7000-8000-0000000000aa";

describe("LocalMediaStorage", () => {
  let directory: string;
  let storage: LocalMediaStorage;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "heat-media-"));
    storage = new LocalMediaStorage(directory);
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  test("writes atomically and leaves no partial file behind", async () => {
    await storage.write(key, "w320.webp", Buffer.from("abc"));

    expect(await readFile(storage.pathOf(key, "w320.webp"), "utf8")).toBe("abc");
    expect(await readdir(join(directory, key))).toEqual(["w320.webp"]);
  });

  test("removes every file of an asset", async () => {
    await storage.write(key, "w320.webp", Buffer.from("abc"));
    await storage.write(key, "w320.avif", Buffer.from("def"));

    await storage.removeAsset(key);

    await expect(stat(join(directory, key))).rejects.toThrow();
  });

  test("refuses keys and file names that could leave the media directory", () => {
    expect(isMediaKey("../etc")).toBe(false);
    expect(isMediaKey("public/2026/11/not-a-uuid")).toBe(false);
    expect(isMediaFileName("..")).toBe(false);
    expect(isMediaFileName("a/b.webp")).toBe(false);
    expect(() => storage.pathOf(key, "../x")).toThrow();
    expect(() => storage.pathOf("../../etc", "passwd")).toThrow();
  });
});

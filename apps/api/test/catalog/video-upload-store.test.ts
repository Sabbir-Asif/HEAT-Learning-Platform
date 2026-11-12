import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { ApiException } from "../../src/http/api-exception";
import { FileUploadStore } from "../../src/catalog/video-upload-store";

const key = "A".repeat(32);
const createdAt = new Date("2026-11-11T06:00:00.000Z");

describe("FileUploadStore", () => {
  let root: string;
  let store: FileUploadStore;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "heat-upload-"));
    store = new FileUploadStore(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("a new upload starts empty at offset zero with the declared length", async () => {
    await store.create(key, 100, createdAt);
    expect(await store.state(key)).toEqual({ length: 100, offset: 0, createdAt, complete: false });
  });

  test("an unknown key has no state", async () => {
    expect(await store.state(key)).toBeNull();
  });

  test("appending continues from the stored offset and reports the new one", async () => {
    await store.create(key, 10, createdAt);
    expect(await store.append(key, Readable.from([Buffer.from("abcd")]), 10)).toBe(4);
    expect(await store.append(key, Readable.from([Buffer.from("efg")]), 6)).toBe(7);
    expect(await readFile(join(root, `${key}.part`), "utf8")).toBe("abcdefg");
    expect((await store.state(key))?.offset).toBe(7);
  });

  test("a stream longer than the room left is refused and nothing past the room is written", async () => {
    await store.create(key, 4, createdAt);
    const failure = await store
      .append(key, Readable.from([Buffer.from("abc"), Buffer.from("defg")]), 4)
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiException);
    expect((failure as ApiException).code).toBe("UPLOAD_TOO_LARGE");
    expect((await store.state(key))?.offset ?? 99).toBeLessThanOrEqual(3);
  });

  test("a connection that drops keeps what arrived and reports that offset", async () => {
    await store.create(key, 20, createdAt);
    const source = new Readable({ read() {} });
    source.push(Buffer.from("hello"));
    const pending = store.append(key, source, 20);
    setTimeout(() => source.destroy(new Error("connection reset")), 20);
    expect(await pending).toBe(5);
  });

  test("head returns the first bytes written", async () => {
    await store.create(key, 20, createdAt);
    await store.append(key, Readable.from([Buffer.from("0123456789")]), 20);
    expect((await store.head(key, 4)).toString()).toBe("0123");
  });

  test("completing renames the partial file to the original and reports complete", async () => {
    await store.create(key, 3, createdAt);
    await store.append(key, Readable.from([Buffer.from("abc")]), 3);
    await store.complete(key);
    expect(await store.state(key)).toEqual({ length: 3, offset: 3, createdAt, complete: true });
    expect((await readdir(root)).sort()).toEqual([`${key}.info`, `${key}.orig`]);
  });

  test("discarding removes every file of the upload", async () => {
    await store.create(key, 3, createdAt);
    await store.discard(key);
    expect(await readdir(root)).toEqual([]);
    expect(await store.state(key)).toBeNull();
  });

  test("a key that could leave the directory is refused before touching the disk", async () => {
    for (const bad of ["../../etc/passwd", `${key}/x`, "short", `${"A".repeat(31)}.`]) {
      await expect(store.create(bad, 5, createdAt)).rejects.toThrow("Invalid upload key");
      await expect(store.state(bad)).rejects.toThrow("Invalid upload key");
    }
    expect((await stat(root)).isDirectory()).toBe(true);
    expect(await readdir(root)).toEqual([]);
  });
});

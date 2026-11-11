import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  CERTIFICATE_KEY_PATTERN,
  LocalCertificateStorage,
  nodeCertificateFileOperations,
  sha256Of,
} from "../../src/certificate/local-certificate-storage";
import type { CertificateFileOperations } from "../../src/certificate/local-certificate-storage";

let root: string;
let directory: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "heat-certificate-"));
  directory = join(root, "store");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const bytes = new TextEncoder().encode("%PDF-1.7 certificate bytes");

describe("LocalCertificateStorage", () => {
  test("writes the file under a random key with a matching hash and size", async () => {
    const storage = new LocalCertificateStorage(directory);
    const stored = await storage.save(bytes);

    expect(stored.key).toMatch(CERTIFICATE_KEY_PATTERN);
    expect(stored.sizeBytes).toBe(bytes.byteLength);
    const onDisk = await readFile(storage.pathFor(stored.key));
    expect(stored.sha256).toBe(sha256Of(onDisk));
    expect(Buffer.compare(onDisk, Buffer.from(bytes))).toBe(0);
  });

  test("uses owner-only permissions and leaves no partial file", async () => {
    const storage = new LocalCertificateStorage(directory);
    const stored = await storage.save(bytes);

    expect((await stat(directory)).mode & 0o777).toBe(0o700);
    expect((await stat(storage.pathFor(stored.key))).mode & 0o777).toBe(0o600);
    expect(await readdir(directory)).toEqual([stored.key]);
  });

  test("generates a different key for every save", async () => {
    const storage = new LocalCertificateStorage(directory);
    const first = await storage.save(bytes);
    const second = await storage.save(bytes);
    expect(first.key).not.toBe(second.key);
  });

  test("removes a saved file", async () => {
    const storage = new LocalCertificateStorage(directory);
    const stored = await storage.save(bytes);
    await storage.remove(stored.key);
    expect(await readdir(directory)).toEqual([]);
  });

  test("rejects keys that could leave the directory", () => {
    const storage = new LocalCertificateStorage(directory);
    expect(() => storage.pathFor("../secret.pdf")).toThrow("Invalid certificate storage key");
    expect(() => storage.pathFor("abc.pdf")).toThrow("Invalid certificate storage key");
  });

  test("never exposes a half-written file when the write fails", async () => {
    const failing: CertificateFileOperations = {
      ...nodeCertificateFileOperations,
      writeDurable: async (path, data) => {
        await nodeCertificateFileOperations.writeDurable(path, data.slice(0, 5));
        throw new Error("disk full");
      },
    };
    const storage = new LocalCertificateStorage(directory, failing);

    await expect(storage.save(bytes)).rejects.toThrow("disk full");
    expect(await readdir(directory)).toEqual([]);
  });

  test("removes the file when the re-read does not match the written bytes", async () => {
    const corrupting: CertificateFileOperations = {
      ...nodeCertificateFileOperations,
      read: async () => new TextEncoder().encode("different"),
    };
    const storage = new LocalCertificateStorage(directory, corrupting);

    await expect(storage.save(bytes)).rejects.toThrow("does not match");
    expect(await readdir(directory)).toEqual([]);
  });

  test("removes the file when the re-read has the same size but different content", async () => {
    const corrupting: CertificateFileOperations = {
      ...nodeCertificateFileOperations,
      read: async () => new Uint8Array(bytes.byteLength).fill(1),
    };
    const storage = new LocalCertificateStorage(directory, corrupting);

    await expect(storage.save(bytes)).rejects.toThrow("does not match");
    expect(await readdir(directory)).toEqual([]);
  });

  test("the final key only appears after the rename", async () => {
    const seen: string[][] = [];
    const observing: CertificateFileOperations = {
      ...nodeCertificateFileOperations,
      rename: async (from, to) => {
        seen.push(await readdir(directory));
        await nodeCertificateFileOperations.rename(from, to);
      },
    };
    const storage = new LocalCertificateStorage(directory, observing);
    const stored = await storage.save(bytes);

    expect(seen[0]).toEqual([`${stored.key}.partial`]);
  });
});

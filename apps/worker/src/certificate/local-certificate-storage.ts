import { createHash, randomBytes } from "node:crypto";
import { chmod, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import type { CertificateStorage, StoredFile } from "./certificate-ports";

export const CERTIFICATE_KEY_PATTERN = /^[0-9a-f]{64}\.pdf$/;

const directoryMode = 0o700;
const fileMode = 0o600;
const keyBytes = 32;

export interface CertificateFileOperations {
  writeDurable(path: string, bytes: Uint8Array): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  read(path: string): Promise<Uint8Array>;
  remove(path: string): Promise<void>;
  prepareDirectory(path: string): Promise<void>;
}

export const nodeCertificateFileOperations: CertificateFileOperations = {
  async writeDurable(path, bytes) {
    const handle = await open(path, "wx", fileMode);
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
  },
  rename,
  read: (path) => readFile(path),
  remove: (path) => rm(path, { force: true }),
  async prepareDirectory(path) {
    await mkdir(path, { recursive: true, mode: directoryMode });
    await chmod(path, directoryMode);
  },
};

export const sha256Of = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

export class LocalCertificateStorage implements CertificateStorage {
  constructor(
    private readonly directory: string,
    private readonly operations: CertificateFileOperations = nodeCertificateFileOperations,
    private readonly randomKey: () => string = () => randomBytes(keyBytes).toString("hex"),
  ) {}

  pathFor(key: string): string {
    if (!CERTIFICATE_KEY_PATTERN.test(key)) throw new Error("Invalid certificate storage key");
    return join(this.directory, key);
  }

  async save(bytes: Uint8Array): Promise<StoredFile> {
    await this.operations.prepareDirectory(this.directory);
    const key = `${this.randomKey()}.pdf`;
    const finalPath = this.pathFor(key);
    const temporaryPath = `${finalPath}.partial`;
    const sha256 = sha256Of(bytes);
    try {
      await this.operations.writeDurable(temporaryPath, bytes);
      await this.operations.rename(temporaryPath, finalPath);
      const stored = await this.operations.read(finalPath);
      if (stored.byteLength !== bytes.byteLength || sha256Of(stored) !== sha256) {
        throw new Error("Stored certificate does not match the rendered bytes");
      }
    } catch (error) {
      await this.operations.remove(temporaryPath);
      await this.operations.remove(finalPath);
      throw error;
    }
    return { key, sha256, sizeBytes: bytes.byteLength };
  }

  async read(key: string): Promise<Uint8Array> {
    return this.operations.read(this.pathFor(key));
  }

  async remove(key: string): Promise<void> {
    await this.operations.remove(this.pathFor(key));
  }
}

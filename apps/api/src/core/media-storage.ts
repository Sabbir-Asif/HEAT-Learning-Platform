import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

export interface MediaStorage {
  write(key: string, file: string, bytes: Uint8Array): Promise<void>;
  removeAsset(key: string): Promise<void>;
  pathOf(key: string, file: string): string;
}

export const MEDIA_STORAGE = Symbol("MEDIA_STORAGE");

const keyPattern =
  /^(public|protected|private)\/\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const filePattern = /^[A-Za-z0-9_.-]{1,64}$/;
const directoryMode = 0o750;
const fileMode = 0o640;

export const isMediaKey = (key: string): boolean => keyPattern.test(key);

export const isMediaFileName = (file: string): boolean =>
  filePattern.test(file) && file !== "." && file !== "..";

export class LocalMediaStorage implements MediaStorage {
  private readonly root: string;

  constructor(directory: string) {
    this.root = resolve(directory);
  }

  pathOf(key: string, file: string): string {
    if (!isMediaKey(key) || !isMediaFileName(file)) throw new Error("Invalid media storage path");
    const path = resolve(this.root, key, file);
    if (!path.startsWith(this.root + sep)) throw new Error("Invalid media storage path");
    return path;
  }

  async write(key: string, file: string, bytes: Uint8Array): Promise<void> {
    const finalPath = this.pathOf(key, file);
    const temporaryPath = `${finalPath}.partial`;
    await mkdir(join(this.root, key), { recursive: true, mode: directoryMode });
    try {
      await writeFile(temporaryPath, bytes, { mode: fileMode, flag: "wx" });
      await rename(temporaryPath, finalPath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
  }

  async removeAsset(key: string): Promise<void> {
    if (!isMediaKey(key)) throw new Error("Invalid media storage path");
    await rm(join(this.root, key), { recursive: true, force: true });
  }
}

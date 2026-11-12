import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

export interface CaptionStore {
  write(assetKey: string, language: string, bytes: Uint8Array): Promise<void>;
  remove(assetKey: string, language: string): Promise<void>;
}

export const CAPTION_STORE = Symbol("CAPTION_STORE");

const assetKeyPattern = /^[A-Za-z0-9_-]{1,64}$/;
const languagePattern = /^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/;
const directoryMode = 0o755;
const fileMode = 0o644;

export class FileCaptionStore implements CaptionStore {
  private readonly root: string;

  constructor(directory: string) {
    this.root = resolve(directory);
  }

  async write(assetKey: string, language: string, bytes: Uint8Array): Promise<void> {
    const finalPath = this.pathOf(assetKey, language);
    const temporaryPath = `${finalPath}.partial`;
    await mkdir(this.directoryOf(assetKey), { recursive: true, mode: directoryMode });
    try {
      await writeFile(temporaryPath, bytes, { mode: fileMode });
      await rename(temporaryPath, finalPath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
  }

  async remove(assetKey: string, language: string): Promise<void> {
    await rm(this.pathOf(assetKey, language), { force: true });
  }

  private directoryOf(assetKey: string): string {
    if (!assetKeyPattern.test(assetKey)) throw new Error("Invalid caption storage path");
    return join(this.root, assetKey, "captions");
  }

  private pathOf(assetKey: string, language: string): string {
    if (!languagePattern.test(language)) throw new Error("Invalid caption storage path");
    const path = resolve(this.directoryOf(assetKey), `${language}.vtt`);
    if (!path.startsWith(this.root + sep)) throw new Error("Invalid caption storage path");
    return path;
  }
}

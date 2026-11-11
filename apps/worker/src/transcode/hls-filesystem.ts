import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";

export interface HlsFilesystem {
  makeDirectory(path: string): Promise<void>;
  writeText(path: string, text: string): Promise<void>;
  readText(path: string): Promise<string | null>;
  exists(path: string): Promise<boolean>;
  rename(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}

const isMissing = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";

export class NodeHlsFilesystem implements HlsFilesystem {
  async makeDirectory(path: string): Promise<void> {
    await mkdir(path, { recursive: true, mode: 0o755 });
  }

  async writeText(path: string, text: string): Promise<void> {
    await writeFile(path, text, { mode: 0o644 });
  }

  async readText(path: string): Promise<string | null> {
    try {
      return await readFile(path, "utf8");
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
  }

  rename(from: string, to: string): Promise<void> {
    return rename(from, to);
  }

  remove(path: string): Promise<void> {
    return rm(path, { recursive: true, force: true });
  }
}

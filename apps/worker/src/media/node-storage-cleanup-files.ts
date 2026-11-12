import { lstat, readFile, readdir, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import type { StorageCleanupFiles, StorageEntry } from "./storage-cleanup";

const isMissing = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";

export class NodeStorageCleanupFiles implements StorageCleanupFiles {
  private readonly roots: string[];

  constructor(roots: string[]) {
    this.roots = roots.map((root) => resolve(root));
  }

  async list(directory: string): Promise<StorageEntry[]> {
    const base = this.contain(directory, true);
    let names: string[];
    try {
      names = await readdir(base);
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }
    const entries: StorageEntry[] = [];
    for (const name of names) {
      try {
        const stats = await lstat(resolve(base, name));
        entries.push({
          name,
          modifiedAt: stats.mtime,
          isDirectory: stats.isDirectory(),
          isFile: stats.isFile(),
        });
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
    }
    return entries;
  }

  async readText(path: string): Promise<string | null> {
    const target = this.contain(path, false);
    try {
      if (!(await lstat(target)).isFile()) return null;
      return await readFile(target, "utf8");
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async sizeOf(path: string): Promise<number> {
    return this.measure(this.contain(path, false));
  }

  async remove(path: string): Promise<void> {
    await rm(this.contain(path, false), { recursive: true, force: true });
  }

  private async measure(target: string): Promise<number> {
    let stats;
    try {
      stats = await lstat(target);
    } catch (error) {
      if (isMissing(error)) return 0;
      throw error;
    }
    if (stats.isSymbolicLink()) return 0;
    if (!stats.isDirectory()) return stats.size;
    let total = 0;
    for (const name of await readdir(target)) total += await this.measure(resolve(target, name));
    return total;
  }

  private contain(path: string, allowRoot: boolean): string {
    const target = resolve(path);
    for (const root of this.roots) {
      if (target === root) {
        if (allowRoot) return target;
        continue;
      }
      if (target.startsWith(root + sep)) return target;
    }
    throw new Error("Path is outside the cleanup directories");
  }
}

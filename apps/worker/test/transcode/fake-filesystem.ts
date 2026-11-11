import type { HlsFilesystem } from "../../src/transcode/hls-filesystem";

export class FakeFilesystem implements HlsFilesystem {
  readonly files = new Map<string, string>();
  readonly directories = new Set<string>();
  readonly log: string[] = [];
  failRenameTo: string | null = null;

  makeDirectory(path: string): Promise<void> {
    this.directories.add(path);
    return Promise.resolve();
  }

  writeText(path: string, text: string): Promise<void> {
    this.files.set(path, text);
    return Promise.resolve();
  }

  readText(path: string): Promise<string | null> {
    return Promise.resolve(this.files.get(path) ?? null);
  }

  exists(path: string): Promise<boolean> {
    const prefix = `${path}/`;
    const found =
      this.files.has(path) ||
      this.directories.has(path) ||
      [...this.files.keys()].some((key) => key.startsWith(prefix));
    return Promise.resolve(found);
  }

  rename(from: string, to: string): Promise<void> {
    this.log.push(`rename ${from} -> ${to}`);
    if (this.failRenameTo === to) return Promise.reject(new Error("rename failed"));
    const prefix = `${from}/`;
    for (const [key, value] of [...this.files]) {
      if (key === from || key.startsWith(prefix)) {
        this.files.delete(key);
        this.files.set(to + key.slice(from.length), value);
      }
    }
    for (const key of [...this.directories]) {
      if (key === from || key.startsWith(prefix)) {
        this.directories.delete(key);
        this.directories.add(to + key.slice(from.length));
      }
    }
    return Promise.resolve();
  }

  remove(path: string): Promise<void> {
    this.log.push(`remove ${path}`);
    const prefix = `${path}/`;
    for (const key of [...this.files.keys()]) {
      if (key === path || key.startsWith(prefix)) this.files.delete(key);
    }
    for (const key of [...this.directories]) {
      if (key === path || key.startsWith(prefix)) this.directories.delete(key);
    }
    return Promise.resolve();
  }

  filesUnder(path: string): string[] {
    return [...this.files.keys()].filter((key) => key.startsWith(`${path}/`)).sort();
  }
}

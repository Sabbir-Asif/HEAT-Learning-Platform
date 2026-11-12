import { describe, expect, test } from "vitest";
import { StorageCleanup, orphanGraceHours } from "../../src/media/storage-cleanup";
import type {
  OrphanAsset,
  StorageCleanupFiles,
  StorageCleanupSettings,
  StorageCleanupStore,
  StorageEntry,
} from "../../src/media/storage-cleanup";

const now = new Date("2026-11-12T10:00:00.000Z");
const hoursAgo = (hours: number): Date => new Date(now.getTime() - hours * 3_600_000);
const settings: StorageCleanupSettings = {
  uploadDirectory: "/uploads",
  hlsDirectory: "/hls",
  uploadExpiryHours: 24,
};
const log = { info: () => undefined, error: () => undefined };

const keyA = "a".repeat(32);
const keyB = "b".repeat(32);
const attempt = "0123456789abcdef0123456789abcdef";

class FakeStore implements StorageCleanupStore {
  removed: string[] = [];
  cutoffs: Date[] = [];

  constructor(
    private orphans: OrphanAsset[],
    private active: string[] = [],
  ) {}

  async activeAssetKeys(): Promise<Set<string>> {
    return new Set(this.active);
  }

  async findOrphans(updatedBefore: Date, afterId: string | null): Promise<OrphanAsset[]> {
    this.cutoffs.push(updatedBefore);
    return this.orphans.filter(
      (asset) => !this.removed.includes(asset.id) && (afterId === null || asset.id > afterId),
    );
  }

  async removeOrphan(id: string): Promise<boolean> {
    this.removed.push(id);
    return true;
  }
}

class FakeFiles implements StorageCleanupFiles {
  removed: string[] = [];
  texts = new Map<string, string>();

  constructor(
    private listings: Record<string, StorageEntry[]>,
    private sizes: Record<string, number> = {},
  ) {}

  async list(directory: string): Promise<StorageEntry[]> {
    return this.listings[directory] ?? [];
  }

  async readText(path: string): Promise<string | null> {
    return this.texts.get(path) ?? null;
  }

  async sizeOf(path: string): Promise<number> {
    return this.sizes[path] ?? 0;
  }

  async remove(path: string): Promise<void> {
    this.removed.push(path);
  }
}

const directory = (name: string, modifiedAt: Date): StorageEntry => ({
  name,
  modifiedAt,
  isDirectory: true,
  isFile: false,
});

const file = (name: string, modifiedAt: Date): StorageEntry => ({
  name,
  modifiedAt,
  isDirectory: false,
  isFile: true,
});

const cleanup = (store: FakeStore, files: FakeFiles) =>
  new StorageCleanup(store, files, settings, () => now, log);

describe("StorageCleanup temp directories", () => {
  test("removes a stale temp directory of a failed attempt and keeps one of a running job", async () => {
    const files = new FakeFiles(
      {
        "/hls": [
          directory(`.staging-${keyA}-${attempt}`, hoursAgo(5)),
          directory(`.staging-${keyB}-${attempt}`, hoursAgo(5)),
          directory(keyA, hoursAgo(50)),
        ],
      },
      { [`/hls/.staging-${keyA}-${attempt}`]: 700 },
    );

    const report = await cleanup(new FakeStore([], [keyB]), files).run(false);

    expect(files.removed).toEqual([`/hls/.staging-${keyA}-${attempt}`]);
    expect(report.tempDirectories).toBe(1);
    expect(report.bytesFreed).toBe(700);
  });

  test("keeps a temp directory younger than the minimum age", async () => {
    const files = new FakeFiles({
      "/hls": [directory(`.previous-${keyA}-${attempt}`, hoursAgo(0))],
    });

    await cleanup(new FakeStore([]), files).run(false);

    expect(files.removed).toEqual([]);
  });
});

describe("StorageCleanup partial uploads", () => {
  test("removes an abandoned upload older than the threshold", async () => {
    const files = new FakeFiles(
      {
        "/uploads": [
          file(`${keyA}.part`, hoursAgo(30)),
          file(`${keyA}.info`, hoursAgo(30)),
          file(`${keyB}.part`, hoursAgo(2)),
          file(`${keyB}.info`, hoursAgo(2)),
        ],
      },
      { [`/uploads/${keyA}.part`]: 10, [`/uploads/${keyA}.info`]: 5 },
    );
    files.texts.set(
      `/uploads/${keyA}.info`,
      JSON.stringify({ createdAt: hoursAgo(30).toISOString() }),
    );
    files.texts.set(
      `/uploads/${keyB}.info`,
      JSON.stringify({ createdAt: hoursAgo(2).toISOString() }),
    );

    const report = await cleanup(new FakeStore([]), files).run(false);

    expect(files.removed).toEqual([`/uploads/${keyA}.part`, `/uploads/${keyA}.info`]);
    expect(report.partialUploads).toBe(1);
    expect(report.bytesFreed).toBe(15);
  });

  test("leaves completed uploads and unrelated files alone", async () => {
    const files = new FakeFiles({
      "/uploads": [
        file(`${keyA}.orig`, hoursAgo(90)),
        file(`${keyA}.info`, hoursAgo(90)),
        file("notes.txt", hoursAgo(90)),
      ],
    });

    await cleanup(new FakeStore([]), files).run(false);

    expect(files.removed).toEqual([]);
  });
});

describe("StorageCleanup orphaned assets", () => {
  const orphan = { id: "1", assetKey: keyA };

  test("deletes the original and HLS directory of an unreferenced asset and its record", async () => {
    const store = new FakeStore([orphan]);
    const files = new FakeFiles({});

    const report = await cleanup(store, files).run(false);

    expect(files.removed).toContain(`/uploads/${keyA}.orig`);
    expect(files.removed).toContain(`/hls/${keyA}`);
    expect(store.removed).toEqual(["1"]);
    expect(report.assets).toBe(1);
    expect(store.cutoffs[0]?.getTime()).toBe(hoursAgo(orphanGraceHours).getTime());
  });

  test("keeps files when the record is no longer an orphan", async () => {
    const store = new FakeStore([orphan]);
    store.removeOrphan = async () => false;

    const report = await cleanup(store, new FakeFiles({})).run(false);

    expect(report.assets).toBe(0);
  });

  test("skips assets with an unsafe key", async () => {
    const files = new FakeFiles({});

    await cleanup(new FakeStore([{ id: "2", assetKey: "../etc" }]), files).run(false);

    expect(files.removed).toEqual([]);
  });

  test("a second run with nothing left removes nothing", async () => {
    const store = new FakeStore([orphan]);
    const files = new FakeFiles({});
    const job = cleanup(store, files);
    await job.run(false);
    files.removed = [];

    const report = await job.run(false);

    expect(files.removed).toEqual([]);
    expect(report.assets).toBe(0);
  });
});

describe("StorageCleanup dry run", () => {
  test("reports what it would delete and deletes nothing", async () => {
    const store = new FakeStore([{ id: "1", assetKey: keyA }]);
    const files = new FakeFiles(
      {
        "/hls": [directory(`.staging-${keyB}-${attempt}`, hoursAgo(9))],
        "/uploads": [file(`${keyB}.part`, hoursAgo(40))],
      },
      { [`/hls/${keyA}`]: 100 },
    );

    const report = await cleanup(store, files).run(true);

    expect(files.removed).toEqual([]);
    expect(store.removed).toEqual([]);
    expect(report).toMatchObject({
      dryRun: true,
      tempDirectories: 1,
      partialUploads: 1,
      assets: 1,
    });
    expect(report.bytesFreed).toBe(100);
  });
});

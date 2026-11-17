export interface StorageEntry {
  name: string;
  modifiedAt: Date;
  isDirectory: boolean;
  isFile: boolean;
}

export interface StorageCleanupFiles {
  list(directory: string): Promise<StorageEntry[]>;
  readText(path: string): Promise<string | null>;
  sizeOf(path: string): Promise<number>;
  remove(path: string): Promise<void>;
}

export interface OrphanAsset {
  id: string;
  assetKey: string;
}

export interface StorageCleanupStore {
  activeAssetKeys(): Promise<Set<string>>;
  findOrphans(updatedBefore: Date, afterId: string | null, limit: number): Promise<OrphanAsset[]>;
  removeOrphan(id: string): Promise<boolean>;
}

export interface StorageCleanupLog {
  info(message: string): void;
  error(message: string): void;
}

export interface StorageCleanupSettings {
  uploadDirectory: string;
  hlsDirectory: string;
  uploadExpiryHours: number;
}

export interface StorageCleanupReport {
  dryRun: boolean;
  tempDirectories: number;
  partialUploads: number;
  assets: number;
  bytesFreed: number;
}

export const tempDirectoryMinAgeHours = 1;
export const orphanGraceHours = 24;
export const orphanBatchSize = 100;

const hourMilliseconds = 3_600_000;
const tempDirectoryName = /^\.(?:staging|previous)-([A-Za-z0-9_-]{32})-[0-9a-f]{32}$/;
const uploadFileName = /^([A-Za-z0-9_-]{32})\.(part|info|orig)$/;
const safeKey = /^[A-Za-z0-9_-]{32}$/;

const joinPath = (directory: string, name: string): string =>
  `${directory.replace(/\/+$/, "")}/${name}`;

const createdAtOf = (text: string | null): Date | null => {
  if (text === null) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || !("createdAt" in parsed)) return null;
    const value = typeof parsed.createdAt === "string" ? new Date(parsed.createdAt) : null;
    return value === null || Number.isNaN(value.getTime()) ? null : value;
  } catch {
    return null;
  }
};

export class StorageCleanup {
  constructor(
    private readonly store: StorageCleanupStore,
    private readonly files: StorageCleanupFiles,
    private readonly settings: StorageCleanupSettings,
    private readonly now: () => Date,
    private readonly log: StorageCleanupLog,
  ) {}

  async run(dryRun: boolean): Promise<StorageCleanupReport> {
    const report: StorageCleanupReport = {
      dryRun,
      tempDirectories: 0,
      partialUploads: 0,
      assets: 0,
      bytesFreed: 0,
    };
    await this.guarded("temp directories", () => this.cleanTempDirectories(dryRun, report));
    await this.guarded("partial uploads", () => this.cleanPartialUploads(dryRun, report));
    await this.guarded("orphaned assets", () => this.cleanOrphans(dryRun, report));
    const prefix = dryRun ? "storage cleanup dry run would remove" : "storage cleanup removed";
    this.log.info(
      `${prefix} ${report.tempDirectories} temp directories, ${report.partialUploads} partial uploads, ${report.assets} assets, ${report.bytesFreed} bytes`,
    );
    return report;
  }

  private async guarded(step: string, action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch {
      this.log.error(`storage cleanup step failed: ${step}`);
    }
  }

  private async discard(
    path: string,
    dryRun: boolean,
    report: StorageCleanupReport,
  ): Promise<void> {
    const size = await this.files.sizeOf(path);
    if (!dryRun) await this.files.remove(path);
    report.bytesFreed += size;
  }

  private async cleanTempDirectories(dryRun: boolean, report: StorageCleanupReport): Promise<void> {
    const entries = await this.files.list(this.settings.hlsDirectory);
    const active = await this.store.activeAssetKeys();
    const cutoff = this.now().getTime() - tempDirectoryMinAgeHours * hourMilliseconds;
    for (const entry of entries) {
      const match = tempDirectoryName.exec(entry.name);
      const key = match?.[1];
      if (key === undefined || !entry.isDirectory) continue;
      if (active.has(key) || entry.modifiedAt.getTime() > cutoff) continue;
      try {
        await this.discard(joinPath(this.settings.hlsDirectory, entry.name), dryRun, report);
        report.tempDirectories += 1;
      } catch {
        this.log.error("storage cleanup failed to remove a temp directory");
      }
    }
  }

  private async cleanPartialUploads(dryRun: boolean, report: StorageCleanupReport): Promise<void> {
    const entries = await this.files.list(this.settings.uploadDirectory);
    const groups = new Map<string, Map<string, StorageEntry>>();
    for (const entry of entries) {
      const match = uploadFileName.exec(entry.name);
      const key = match?.[1];
      const kind = match?.[2];
      if (key === undefined || kind === undefined || !entry.isFile) continue;
      const group = groups.get(key) ?? new Map<string, StorageEntry>();
      group.set(kind, entry);
      groups.set(key, group);
    }
    const cutoff = this.now().getTime() - this.settings.uploadExpiryHours * hourMilliseconds;
    for (const [key, group] of groups) {
      if (group.has("orig")) continue;
      const info = group.get("info");
      const recorded =
        info === undefined
          ? null
          : createdAtOf(
              await this.files.readText(joinPath(this.settings.uploadDirectory, info.name)),
            );
      const createdAt =
        recorded ??
        new Date(Math.min(...[...group.values()].map((entry) => entry.modifiedAt.getTime())));
      if (createdAt.getTime() > cutoff) continue;
      try {
        for (const entry of group.values()) {
          await this.discard(joinPath(this.settings.uploadDirectory, entry.name), dryRun, report);
        }
        report.partialUploads += 1;
      } catch {
        this.log.error(`storage cleanup failed to remove a partial upload ${key}`);
      }
    }
  }

  private async cleanOrphans(dryRun: boolean, report: StorageCleanupReport): Promise<void> {
    const cutoff = new Date(this.now().getTime() - orphanGraceHours * hourMilliseconds);
    let afterId: string | null = null;
    for (;;) {
      const batch = await this.store.findOrphans(cutoff, afterId, orphanBatchSize);
      for (const asset of batch) {
        afterId = asset.id;
        if (!safeKey.test(asset.assetKey)) continue;
        try {
          if (await this.removeAsset(asset, dryRun, report)) report.assets += 1;
        } catch {
          this.log.error(`storage cleanup failed for asset ${asset.id}`);
        }
      }
      if (batch.length < orphanBatchSize) break;
    }
  }

  private async removeAsset(
    asset: OrphanAsset,
    dryRun: boolean,
    report: StorageCleanupReport,
  ): Promise<boolean> {
    const paths = [
      ...["orig", "part", "info"].map((kind) =>
        joinPath(this.settings.uploadDirectory, `${asset.assetKey}.${kind}`),
      ),
      joinPath(this.settings.hlsDirectory, asset.assetKey),
    ];
    for (const path of paths) await this.discard(path, dryRun, report);
    if (dryRun) return true;
    return this.store.removeOrphan(asset.id);
  }
}

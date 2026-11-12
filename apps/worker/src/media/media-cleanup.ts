export interface UnlinkedAsset {
  id: string;
  key: string;
}

export interface MediaCleanupStore {
  findUnlinked(createdBefore: Date, limit: number): Promise<UnlinkedAsset[]>;
  remove(id: string): Promise<void>;
}

export interface MediaCleanupStorage {
  removeAsset(key: string): Promise<void>;
}

export interface MediaCleanupLog {
  info(message: string): void;
  error(message: string): void;
}

export const unlinkedRetentionHours = 24;
export const cleanupBatchSize = 200;
const hourMilliseconds = 3_600_000;
const dhakaOffsetMilliseconds = 6 * hourMilliseconds;
const runHour = 3;

export const dhakaDay = (now: Date): string =>
  new Date(now.getTime() + dhakaOffsetMilliseconds).toISOString().slice(0, 10);

export const dhakaHour = (now: Date): number =>
  new Date(now.getTime() + dhakaOffsetMilliseconds).getUTCHours();

export const isCleanupDue = (now: Date, lastRunDay: string | null): boolean =>
  dhakaHour(now) >= runHour && dhakaDay(now) !== lastRunDay;

export class MediaCleanup {
  constructor(
    private readonly store: MediaCleanupStore,
    private readonly storage: MediaCleanupStorage,
    private readonly now: () => Date,
    private readonly log: MediaCleanupLog,
  ) {}

  async run(): Promise<number> {
    const cutoff = new Date(this.now().getTime() - unlinkedRetentionHours * hourMilliseconds);
    let removed = 0;
    for (;;) {
      const batch = await this.store.findUnlinked(cutoff, cleanupBatchSize);
      let progressed = 0;
      for (const asset of batch) {
        try {
          await this.storage.removeAsset(asset.key);
          await this.store.remove(asset.id);
          progressed += 1;
        } catch {
          this.log.error(`media cleanup failed for asset ${asset.id}`);
        }
      }
      removed += progressed;
      if (progressed === 0 || batch.length < cleanupBatchSize) break;
    }
    this.log.info(`media cleanup removed ${removed} unlinked assets`);
    return removed;
  }
}

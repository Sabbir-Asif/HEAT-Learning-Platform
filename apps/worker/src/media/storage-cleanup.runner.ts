import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { APP_CONFIG, CLOCK, DATABASE } from "api/core";
import type { AppConfig, Clock } from "api/core";
import type { HeatClient } from "@heat/db";
import { dhakaDay, isDailyRunDue } from "./media-cleanup";
import { NodeStorageCleanupFiles } from "./node-storage-cleanup-files";
import { PrismaStorageCleanupStore } from "./prisma-storage-cleanup-store";
import { StorageCleanup } from "./storage-cleanup";

const checkIntervalMs = 10 * 60 * 1000;
const runHour = 4;

@Injectable()
export class StorageCleanupRunner implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger("StorageCleanup");
  private readonly cleanup: StorageCleanup;
  private readonly dryRun: boolean;
  private timer: NodeJS.Timeout | null = null;
  private lastRunDay: string | null = null;
  private running = false;

  constructor(
    @Inject(DATABASE) database: HeatClient,
    @Inject(APP_CONFIG) config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.dryRun = process.env["STORAGE_CLEANUP_DRY_RUN"] === "true";
    const uploadDirectory = config.videoUploads.directory;
    const hlsDirectory = config.transcode.hlsDirectory;
    this.cleanup = new StorageCleanup(
      new PrismaStorageCleanupStore(database),
      new NodeStorageCleanupFiles([uploadDirectory, hlsDirectory]),
      { uploadDirectory, hlsDirectory, uploadExpiryHours: config.videoUploads.expiryHours },
      () => this.clock.now(),
      {
        info: (message) => this.logger.log(message),
        error: (message) => this.logger.error(message),
      },
    );
  }

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.tick(), checkIntervalMs);
  }

  onApplicationShutdown(): void {
    if (this.timer !== null) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    const now = this.clock.now();
    if (this.running || !isDailyRunDue(now, runHour, this.lastRunDay)) return;
    this.running = true;
    try {
      await this.cleanup.run(this.dryRun);
      this.lastRunDay = dhakaDay(now);
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : "Storage cleanup failed");
    } finally {
      this.running = false;
    }
  }
}

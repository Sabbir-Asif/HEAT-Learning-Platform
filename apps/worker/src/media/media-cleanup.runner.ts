import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { CLOCK, DATABASE, MEDIA_STORAGE } from "api/core";
import type { Clock, MediaStorage } from "api/core";
import type { HeatClient } from "@heat/db";
import { MediaCleanup, dhakaDay, isCleanupDue } from "./media-cleanup";
import { PrismaMediaCleanupStore } from "./prisma-media-cleanup-store";

const checkIntervalMs = 10 * 60 * 1000;

@Injectable()
export class MediaCleanupRunner implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger("MediaCleanup");
  private readonly cleanup: MediaCleanup;
  private timer: NodeJS.Timeout | null = null;
  private lastRunDay: string | null = null;
  private running = false;

  constructor(
    @Inject(DATABASE) database: HeatClient,
    @Inject(MEDIA_STORAGE) storage: MediaStorage,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.cleanup = new MediaCleanup(
      new PrismaMediaCleanupStore(database),
      storage,
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
    if (this.running || !isCleanupDue(now, this.lastRunDay)) return;
    this.running = true;
    try {
      await this.cleanup.run();
      this.lastRunDay = dhakaDay(now);
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : "Media cleanup failed");
    } finally {
      this.running = false;
    }
  }
}

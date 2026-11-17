import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { InsightsRollupService } from "api/core";

export const insightsPollIntervalMs = 15 * 1000;

@Injectable()
export class InsightsRollupRunner implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger("InsightsRollup");
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(@Inject(InsightsRollupService) private readonly rollup: InsightsRollupService) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.tick(), insightsPollIntervalMs);
  }

  onApplicationShutdown(): void {
    if (this.timer !== null) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.rollup.tick();
    } catch (error) {
      this.logger.error(error instanceof Error ? error.name : "Insights tick failed");
    } finally {
      this.running = false;
    }
  }
}

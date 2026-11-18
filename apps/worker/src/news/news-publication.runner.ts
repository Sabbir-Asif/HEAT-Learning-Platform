import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { APP_CONFIG, CLOCK, DATABASE } from "api/core";
import type { AppConfig, Clock } from "api/core";
import type { HeatClient } from "@heat/db";
import { HttpNewsRevalidation } from "./http-news-revalidation";
import { NewsPublication } from "./news-publication";
import { PrismaNewsPublicationStore } from "./prisma-news-publication-store";

const pollIntervalMs = 60 * 1000;

@Injectable()
export class NewsPublicationRunner implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger("NewsPublication");
  private readonly publication: NewsPublication;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(DATABASE) database: HeatClient,
    @Inject(CLOCK) clock: Clock,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.publication = new NewsPublication(
      new PrismaNewsPublicationStore(database),
      clock,
      {
        info: (line) => this.logger.log(line),
        error: (line) => this.logger.error(line),
      },
      new HttpNewsRevalidation(config.revalidation),
    );
  }

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.tick(), pollIntervalMs);
  }

  onApplicationShutdown(): void {
    if (this.timer !== null) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.publication.announceDue();
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : "News publication failed");
    } finally {
      this.running = false;
    }
  }
}

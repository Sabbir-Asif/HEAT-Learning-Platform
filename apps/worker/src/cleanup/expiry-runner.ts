import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { CLOCK, DATABASE, REDIS, type Clock } from "api/core";
import type { HeatClient } from "@heat/db";
import type { Redis } from "ioredis";
import { ExpireUnverifiedRegistrations } from "./expire-unverified";
import { nextExpiryRunAt } from "./expiry-schedule";
import { PrismaExpiryStore } from "./prisma-expiry-store";
import { RedisExpiryMetric } from "./redis-expiry-metric";

@Injectable()
export class ExpiryRunner implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger("UnverifiedExpiry");
  private readonly job: ExpireUnverifiedRegistrations;
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(
    @Inject(DATABASE) database: HeatClient,
    @Inject(REDIS) redis: Redis,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.job = new ExpireUnverifiedRegistrations(
      new PrismaExpiryStore(database),
      new RedisExpiryMetric(redis),
      clock,
    );
  }

  onApplicationBootstrap(): void {
    this.schedule();
  }

  onApplicationShutdown(): void {
    this.stopped = true;
    if (this.timer !== null) clearTimeout(this.timer);
  }

  private schedule(): void {
    if (this.stopped) return;
    const now = this.clock.now();
    const delay = nextExpiryRunAt(now).getTime() - now.getTime();
    this.timer = setTimeout(() => void this.tick(), delay);
  }

  private async tick(): Promise<void> {
    try {
      const expired = await this.job.run();
      this.logger.log(`Expired ${expired} unverified registrations`);
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : "Expiry run failed");
    } finally {
      this.schedule();
    }
  }
}

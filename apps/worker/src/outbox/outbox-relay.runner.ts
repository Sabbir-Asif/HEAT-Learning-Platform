import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { CLOCK, DATABASE, REDIS, type Clock } from "api/core";
import type { HeatClient } from "@heat/db";
import type { Redis } from "ioredis";
import {
  CERTIFICATE_QUEUE,
  EMAIL_QUEUE,
  PROBE_QUEUE,
  TRANSCODE_QUEUE,
  createQueue,
  type BullJobQueue,
} from "../queues";
import { readOutboxLagSeconds } from "./outbox-lag";
import { OutboxRelay } from "./outbox-relay";
import { PrismaOutboxStore } from "./prisma-outbox-store";

const pollIntervalMs = 2000;
const batchSize = 50;
const lagWarningSeconds = 60;

@Injectable()
export class OutboxRelayRunner implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger("OutboxRelay");
  private readonly store: PrismaOutboxStore;
  private readonly queues: {
    email: BullJobQueue;
    certificate: BullJobQueue;
    probe: BullJobQueue;
    transcode: BullJobQueue;
  };
  private readonly relay: OutboxRelay;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(DATABASE) database: HeatClient,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.store = new PrismaOutboxStore(database);
    const connection = this.redis.duplicate({ enableOfflineQueue: false });
    this.queues = {
      email: createQueue(EMAIL_QUEUE, connection),
      certificate: createQueue(CERTIFICATE_QUEUE, connection),
      probe: createQueue(PROBE_QUEUE, connection),
      transcode: createQueue(TRANSCODE_QUEUE, connection),
    };
    this.relay = new OutboxRelay(this.store, this.queues, clock, this.logger);
  }

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.tick(), pollIntervalMs);
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer !== null) clearInterval(this.timer);
    await Promise.all([
      this.queues.email.close(),
      this.queues.certificate.close(),
      this.queues.probe.close(),
      this.queues.transcode.close(),
    ]);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.relay.relayBatch(batchSize);
      const lag = await readOutboxLagSeconds(this.store, this.clock);
      if (lag > lagWarningSeconds) this.logger.warn(`Outbox lag ${lag}s`);
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : "Outbox tick failed");
    } finally {
      this.running = false;
    }
  }
}

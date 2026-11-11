import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { APP_CONFIG, CLOCK, DATABASE, MAIL_TRANSPORT, REDIS, SecretBox } from "api/core";
import type { AppConfig, Clock, MailTransport } from "api/core";
import type { HeatClient } from "@heat/db";
import { Worker } from "bullmq";
import type { Redis } from "ioredis";
import { EMAIL_QUEUE } from "../queues";
import { EmailDelivery } from "./email-delivery";
import type { EmailContext } from "./email-context";
import { renderEmail } from "./template-registry";
import { PrismaEmailDeliveryStore } from "./prisma-email-delivery-store";

const defaultPublicAppUrl = "http://localhost:3000";

class DelayedDelivery extends Error {}

@Injectable()
export class EmailConsumer implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger("EmailConsumer");
  private readonly delivery: EmailDelivery;
  private worker: Worker | null = null;

  constructor(
    @Inject(DATABASE) database: HeatClient,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(MAIL_TRANSPORT) transport: MailTransport,
    @Inject(APP_CONFIG) config: AppConfig,
    @Inject(SecretBox) secretBox: SecretBox,
    @Inject(CLOCK) clock: Clock,
  ) {
    const context: EmailContext = {
      publicAppUrl: process.env["PUBLIC_APP_URL"] ?? defaultPublicAppUrl,
      adminAppUrl: config.invitations.adminAppUrl,
      supportAddress: config.mail.from.address,
    };
    this.delivery = new EmailDelivery(
      new PrismaEmailDeliveryStore(database),
      transport,
      (template, variables) => renderEmail(template, variables, context),
      (sealed) => secretBox.decrypt(sealed),
      clock,
    );
  }

  onApplicationBootstrap(): void {
    const connection = this.redis.duplicate({ maxRetriesPerRequest: null });
    this.worker = new Worker<{ emailJobId: string }>(
      EMAIL_QUEUE,
      async (job) => {
        const attempts = job.opts.attempts ?? 1;
        const outcome = await this.delivery.deliver(
          job.data.emailJobId,
          job.attemptsMade + 1 >= attempts,
        );
        if (outcome === "delayed") throw new DelayedDelivery("Email delayed, will retry");
      },
      { connection },
    );
    this.worker.on("error", (error) => this.logger.error(error.message));
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }
}

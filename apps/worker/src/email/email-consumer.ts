import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { APP_CONFIG, CLOCK, DATABASE, MAIL_TRANSPORT, REDIS, SecretBox } from "api/core";
import type { AppConfig, Clock, MailTransport } from "api/core";
import type { HeatClient } from "@heat/db";
import { DelayedError, Worker } from "bullmq";
import type { Redis } from "ioredis";
import { EMAIL_QUEUE } from "../queues";
import { EmailCapacityWait, EmailDelivery, EmailQuotaPause } from "./email-delivery";
import { EmailQuota } from "./email-quota";
import { loadEmailQuotaConfig } from "./email-quota-config";
import { RedisQuotaLedger } from "./redis-quota-ledger";
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
    @Inject(CLOCK) private readonly clock: Clock,
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
      new EmailQuota(new RedisQuotaLedger(redis), loadEmailQuotaConfig(process.env)),
      clock,
    );
  }

  onApplicationBootstrap(): void {
    const connection = this.redis.duplicate({ maxRetriesPerRequest: null });
    this.worker = new Worker<{ emailJobId: string }>(
      EMAIL_QUEUE,
      async (job, token) => {
        const attempts = job.opts.attempts ?? 1;
        try {
          const outcome = await this.delivery.deliver(
            job.data.emailJobId,
            job.attemptsMade + 1 >= attempts,
          );
          if (outcome === "delayed") throw new DelayedDelivery("Email delayed, will retry");
        } catch (error) {
          if (error instanceof EmailCapacityWait) {
            await job.moveToDelayed(error.retryAt.getTime(), token);
            throw new DelayedError();
          }
          if (error instanceof EmailQuotaPause) {
            await this.worker?.rateLimit(
              Math.max(error.until.getTime() - this.clock.now().getTime(), 1000),
            );
            throw Worker.RateLimitError();
          }
          throw error;
        }
      },
      { connection },
    );
    this.worker.on("error", (error) => this.logger.error(error.message));
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }
}

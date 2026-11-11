import type { HeatClient } from "@heat/db";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { DATABASE, REDIS } from "api/core";
import { Worker } from "bullmq";
import type { Redis } from "ioredis";
import { CERTIFICATE_QUEUE } from "../queues";
import { loadCertificateConfig } from "./certificate-config";
import { CertificateJob } from "./certificate-job";
import type { CertificateLog } from "./certificate-ports";
import { loadCertificateRuntimeConfig } from "./certificate-runtime-config";
import { ChromiumPdfRenderer } from "./chromium-pdf-renderer";
import { LocalCertificateStorage } from "./local-certificate-storage";
import { PrismaCertificateStore } from "./prisma-certificate-store";

export const CERTIFICATE_CONCURRENCY = 1;

export const isFinalCertificateAttempt = (
  attemptsMade: number,
  attempts: number | undefined,
): boolean => attemptsMade + 1 >= (attempts ?? 1);

@Injectable()
export class CertificateConsumer implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger("CertificateConsumer");
  private readonly job: CertificateJob;
  private worker: Worker | null = null;

  constructor(
    @Inject(DATABASE) database: HeatClient,
    @Inject(REDIS) private readonly redis: Redis,
  ) {
    const runtime = loadCertificateRuntimeConfig(process.env);
    const log: CertificateLog = {
      info: (event, fields) => this.logger.log(JSON.stringify({ event, ...fields })),
      error: (event, fields) => this.logger.error(JSON.stringify({ event, ...fields })),
    };
    this.job = new CertificateJob({
      store: new PrismaCertificateStore(database),
      renderer: new ChromiumPdfRenderer(runtime.chromiumExecutablePath, runtime.renderTimeoutMs),
      storage: new LocalCertificateStorage(runtime.storageDirectory),
      log,
      config: loadCertificateConfig(process.env),
      now: () => new Date(),
    });
  }

  onApplicationBootstrap(): void {
    const connection = this.redis.duplicate({ maxRetriesPerRequest: null });
    this.worker = new Worker<{ enrollmentId: string }>(
      CERTIFICATE_QUEUE,
      async (job) => {
        await this.job.run(
          job.data.enrollmentId,
          isFinalCertificateAttempt(job.attemptsMade, job.opts.attempts),
        );
      },
      { connection, concurrency: CERTIFICATE_CONCURRENCY },
    );
    this.worker.on("error", (error) => this.logger.error(error.message));
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }
}

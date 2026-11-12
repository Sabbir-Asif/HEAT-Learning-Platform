import { videoUploadLimits } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { APP_CONFIG, DATABASE, REDIS } from "api/core";
import type { AppConfig } from "api/core";
import { Worker } from "bullmq";
import type { Redis } from "ioredis";
import { PROBE_QUEUE } from "../queues";
import { PrismaProbeStore } from "./prisma-probe-store";
import { FfprobeVideoProbe } from "./video-probe";
import { VideoProbeJob } from "./video-probe-job";

@Injectable()
export class VideoProbeConsumer implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger("VideoProbeConsumer");
  private readonly job: VideoProbeJob;
  private worker: Worker | null = null;

  constructor(
    @Inject(DATABASE) database: HeatClient,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.job = new VideoProbeJob(
      new PrismaProbeStore(database),
      new FfprobeVideoProbe(),
      config.videoUploads.directory,
      videoUploadLimits,
    );
  }

  onApplicationBootstrap(): void {
    const connection = this.redis.duplicate({ maxRetriesPerRequest: null });
    this.worker = new Worker<{ assetId: string }>(
      PROBE_QUEUE,
      async (job) => {
        await this.job.run(job.data.assetId);
      },
      { connection },
    );
    this.worker.on("error", (error) => this.logger.error(error.message));
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }
}

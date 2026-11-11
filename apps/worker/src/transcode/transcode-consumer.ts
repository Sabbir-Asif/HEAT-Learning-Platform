import type { HeatClient } from "@heat/db";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { APP_CONFIG, DATABASE, REDIS } from "api/core";
import type { AppConfig } from "api/core";
import { UnrecoverableError, Worker } from "bullmq";
import type { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import { TRANSCODE_QUEUE } from "../queues";
import { NodeFfmpegRunner } from "./ffmpeg-runner";
import { NodeHlsFilesystem } from "./hls-filesystem";
import { FfprobeCodecProbe, FfprobeSourceProbe } from "./media-probe";
import { PrismaTranscodeStore } from "./prisma-transcode-store";
import { TranscodeJob } from "./transcode-job";
import { isFinalAttempt, transcodeFailure } from "./transcode-outcome";

export const TRANSCODE_CONCURRENCY = 1;

@Injectable()
export class TranscodeConsumer implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger("TranscodeConsumer");
  private readonly job: TranscodeJob;
  private worker: Worker | null = null;

  constructor(
    @Inject(DATABASE) database: HeatClient,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.job = new TranscodeJob(
      {
        store: new PrismaTranscodeStore(database),
        source: new FfprobeSourceProbe(),
        codecs: new FfprobeCodecProbe(),
        ffmpeg: new NodeFfmpegRunner(undefined, undefined, (code) => {
          if (code !== 0) this.logger.warn(`FFmpeg exited with code ${String(code)}`);
        }),
        filesystem: new NodeHlsFilesystem(),
        newAttemptId: () => randomUUID().replaceAll("-", ""),
        nowMs: () => Date.now(),
      },
      {
        uploadDirectory: config.videoUploads.directory,
        hlsDirectory: config.transcode.hlsDirectory,
        timeout: config.transcode.timeout,
      },
    );
  }

  onApplicationBootstrap(): void {
    const connection = this.redis.duplicate({ maxRetriesPerRequest: null });
    this.worker = new Worker<{ assetId: string }>(
      TRANSCODE_QUEUE,
      async (job) => {
        const outcome = await this.job.run(
          job.data.assetId,
          isFinalAttempt(job.attemptsMade, job.opts.attempts),
        );
        const failure = transcodeFailure(outcome);
        if (failure === null) return;
        this.logger.warn(`Transcode ${failure.reason} (${failure.retry ? "retry" : "final"})`);
        if (failure.retry) throw new Error(failure.reason);
        throw new UnrecoverableError(failure.reason);
      },
      { connection, concurrency: TRANSCODE_CONCURRENCY },
    );
    this.worker.on("error", (error) => this.logger.error(error.message));
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
  }
}

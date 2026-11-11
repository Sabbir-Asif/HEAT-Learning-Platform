import { Queue, type ConnectionOptions } from "bullmq";
import type { JobQueue } from "./outbox/outbox-relay";

export const EMAIL_QUEUE = "email";
export const CERTIFICATE_QUEUE = "certificate";
export const TRANSCODE_QUEUE = "transcode";
export const PROBE_QUEUE = "probe";

export interface QueueJobOptions {
  attempts: number;
  backoff: { type: "exponential"; delay: number };
  removeOnComplete: { age: number };
  removeOnFail: false;
}

const week = 7 * 24 * 3600;

const emailJobOptions: QueueJobOptions = {
  attempts: 6,
  backoff: { type: "exponential", delay: 60000 },
  removeOnComplete: { age: week },
  removeOnFail: false,
};

const certificateJobOptions: QueueJobOptions = {
  attempts: 6,
  backoff: { type: "exponential", delay: 60000 },
  removeOnComplete: { age: week },
  removeOnFail: false,
};

const probeJobOptions: QueueJobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 10000 },
  removeOnComplete: { age: week },
  removeOnFail: false,
};

const transcodeJobOptions: QueueJobOptions = {
  attempts: 2,
  backoff: { type: "exponential", delay: 60000 },
  removeOnComplete: { age: week },
  removeOnFail: false,
};

const optionsByQueue: Record<string, QueueJobOptions> = {
  [EMAIL_QUEUE]: emailJobOptions,
  [CERTIFICATE_QUEUE]: certificateJobOptions,
  [PROBE_QUEUE]: probeJobOptions,
  [TRANSCODE_QUEUE]: transcodeJobOptions,
};

export const jobOptionsFor = (queue: string): QueueJobOptions => {
  const options = optionsByQueue[queue];
  if (options === undefined) throw new Error(`No job options for queue ${queue}`);
  return options;
};

export class BullJobQueue implements JobQueue {
  constructor(
    private readonly queue: Queue,
    private readonly options: QueueJobOptions,
  ) {}

  async add(jobId: string, data: Record<string, string>): Promise<void> {
    await this.queue.add(this.queue.name, data, { ...this.options, jobId });
  }

  close(): Promise<void> {
    return this.queue.close();
  }
}

export const createQueue = (name: string, connection: ConnectionOptions): BullJobQueue =>
  new BullJobQueue(new Queue(name, { connection }), jobOptionsFor(name));

import { Queue, type ConnectionOptions } from "bullmq";
import type { JobQueue } from "./outbox/outbox-relay";

export const EMAIL_QUEUE = "email";
export const CERTIFICATE_QUEUE = "certificate";

export const emailJobOptions = {
  attempts: 6,
  backoff: { type: "exponential", delay: 60000 },
  removeOnComplete: { age: 7 * 24 * 3600 },
  removeOnFail: false,
} as const;

export class BullJobQueue implements JobQueue {
  constructor(
    private readonly queue: Queue,
    private readonly options: typeof emailJobOptions,
  ) {}

  async add(jobId: string, data: Record<string, string>): Promise<void> {
    await this.queue.add(this.queue.name, data, { ...this.options, jobId });
  }

  close(): Promise<void> {
    return this.queue.close();
  }
}

export const createQueue = (name: string, connection: ConnectionOptions): BullJobQueue =>
  new BullJobQueue(new Queue(name, { connection }), emailJobOptions);

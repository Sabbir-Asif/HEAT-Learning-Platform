import type { JsonObject } from "./outbox-routing";
import type { EmailCategory } from "../email";
import type { NotificationKind, RoutedAction } from "./outbox-routing";
import { routeOutboxEvent } from "./outbox-routing";

export interface OutboxEvent {
  id: string;
  eventType: string;
  payload: unknown;
  createdAt: Date;
}

export interface EmailJobRecord {
  id: string;
  outboxId: string;
  userId: string;
  recipientAddress: string;
  category: EmailCategory;
  template: string;
}

export interface RelayTransaction {
  findRecipientAddress(userId: string): Promise<string | null>;
  recordEmailJob(job: EmailJobRecord): Promise<void>;
  createNotification(notification: {
    userId: string;
    type: NotificationKind;
    data: JsonObject;
  }): Promise<void>;
}

export interface OutboxStore {
  relayNext(
    work: (event: OutboxEvent, transaction: RelayTransaction) => Promise<void>,
    now: () => Date,
  ): Promise<boolean>;
  oldestUnrelayedAt(): Promise<Date | null>;
}

export interface JobQueue {
  add(jobId: string, data: Record<string, string>): Promise<void>;
}

export interface RelayQueues {
  email: JobQueue;
  certificate: JobQueue;
  transcode: JobQueue;
}

export interface RelayLogger {
  warn(line: string): void;
  error(line: string): void;
}

export interface RelayResult {
  relayed: number;
  stoppedOnError: boolean;
}

export class OutboxRelay {
  constructor(
    private readonly store: OutboxStore,
    private readonly queues: RelayQueues,
    private readonly clock: { now(): Date },
    private readonly logger: RelayLogger,
  ) {}

  async relayBatch(limit: number): Promise<RelayResult> {
    let relayed = 0;
    while (relayed < limit) {
      try {
        const claimed = await this.store.relayNext(
          (event, transaction) => this.relay(event, transaction),
          () => this.clock.now(),
        );
        if (!claimed) break;
        relayed += 1;
      } catch (error) {
        this.logger.error(`Outbox relay stopped: ${describe(error)}`);
        return { relayed, stoppedOnError: true };
      }
    }
    return { relayed, stoppedOnError: false };
  }

  private async relay(event: OutboxEvent, transaction: RelayTransaction): Promise<void> {
    const routing = routeOutboxEvent(event.eventType, event.payload);
    if (routing.outcome === "skipped") {
      this.logger.warn(`Outbox ${event.id} ${event.eventType} not relayed: ${routing.reason}`);
      return;
    }
    for (const action of routing.actions) {
      await this.apply(event, action, transaction);
    }
  }

  private async apply(
    event: OutboxEvent,
    action: RoutedAction,
    transaction: RelayTransaction,
  ): Promise<void> {
    if (action.kind === "notification") {
      await transaction.createNotification({
        userId: action.userId,
        type: action.type,
        data: action.data,
      });
      return;
    }
    if (action.kind === "certificate") {
      await this.queues.certificate.add(event.id, {
        outboxId: event.id,
        enrollmentId: action.enrollmentId,
      });
      return;
    }
    if (action.kind === "transcode") {
      await this.queues.transcode.add(event.id, { outboxId: event.id, assetId: action.assetId });
      return;
    }
    const recipientAddress = await transaction.findRecipientAddress(action.userId);
    if (recipientAddress === null) {
      this.logger.warn(`Outbox ${event.id} has no recipient, email skipped`);
      return;
    }
    await transaction.recordEmailJob({
      id: event.id,
      outboxId: event.id,
      userId: action.userId,
      recipientAddress,
      category: action.category,
      template: action.template,
    });
    await this.queues.email.add(event.id, { emailJobId: event.id });
  }
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : "unknown error";

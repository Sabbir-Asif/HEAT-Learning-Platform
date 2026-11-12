import type { MailMessage, MailTransport } from "api/core";
import { AttachmentUnavailable, type EmailAttachmentSource } from "./certificate-attachment";
import type { EmailQuota } from "./email-quota";
import type { EmailCategory, RenderedEmail } from "./email-template";

export type DeliveryStatus = "QUEUED" | "DELAYED" | "SENDING" | "SENT" | "FAILED";

export interface EmailJobSnapshot {
  id: string;
  status: DeliveryStatus;
  template: string;
  category: EmailCategory;
  recipientAddress: string;
  recipientName: string | null;
  payload: unknown;
}

export interface EmailDeliveryStore {
  load(id: string): Promise<EmailJobSnapshot | null>;
  markSending(id: string): Promise<void>;
  markDelayed(id: string, smtpResponse: string | null): Promise<void>;
  markSent(id: string, smtpResponse: string, at: Date): Promise<void>;
  markFailed(id: string, smtpResponse: string | null, at: Date): Promise<void>;
}

export type EmailRenderer = (template: string, variables: unknown) => Promise<RenderedEmail>;

export type DeliveryOutcome = "sent" | "failed" | "delayed" | "skipped";

export interface EmailDeliveryLog {
  error(event: string, fields: Record<string, string>): void;
}

export class EmailCapacityWait extends Error {
  constructor(readonly retryAt: Date) {
    super("Email waiting for capacity");
  }
}

export class EmailQuotaPause extends Error {
  constructor(readonly until: Date) {
    super("Email provider quota reached, queue paused");
  }
}

const reservedPayloadKeys: ReadonlySet<string> = new Set(["template", "userId", "encryptedToken"]);

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {};

const nameFromAddress = (address: string): string => address.split("@")[0] ?? address;

export class EmailDelivery {
  constructor(
    private readonly store: EmailDeliveryStore,
    private readonly transport: MailTransport,
    private readonly render: EmailRenderer,
    private readonly unseal: (sealed: string) => string,
    private readonly quota: EmailQuota,
    private readonly clock: { now(): Date },
    private readonly attachments?: EmailAttachmentSource,
    private readonly log?: EmailDeliveryLog,
  ) {}

  async deliver(emailJobId: string, finalAttempt: boolean): Promise<DeliveryOutcome> {
    const job = await this.store.load(emailJobId);
    if (job === null) throw new Error(`Email job ${emailJobId} not found`);
    if (job.status === "SENT" || job.status === "FAILED") return "skipped";

    const message = await this.compose(job);
    if (message === null) {
      await this.store.markFailed(job.id, null, this.clock.now());
      return "failed";
    }

    const reservation = await this.quota.reserve(job.category, this.clock.now());
    if (!reservation.granted) {
      await this.store.markDelayed(job.id, null);
      throw new EmailCapacityWait(reservation.retryAt);
    }

    await this.store.markSending(job.id);
    const result = await this.transport.send(message);
    const response = result.responseCode === null ? null : String(result.responseCode);

    if (result.status === "sent") {
      await this.store.markSent(job.id, String(result.responseCode), this.clock.now());
      return "sent";
    }
    await this.quota.release(reservation.reservationId);
    if (result.status === "quota-exceeded") {
      await this.store.markDelayed(job.id, response);
      throw new EmailQuotaPause(await this.quota.resumeAt(this.clock.now()));
    }
    if (result.status === "permanent-failure" || finalAttempt) {
      await this.store.markFailed(job.id, response, this.clock.now());
      return "failed";
    }
    await this.store.markDelayed(job.id, response);
    return "delayed";
  }

  private async compose(job: EmailJobSnapshot): Promise<MailMessage | null> {
    try {
      const payload = asRecord(job.payload);
      const variables: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(payload)) {
        if (!reservedPayloadKeys.has(key)) variables[key] = value;
      }
      variables["name"] = job.recipientName ?? nameFromAddress(job.recipientAddress);
      const sealed = payload["encryptedToken"];
      if (typeof sealed === "string") variables["token"] = this.unseal(sealed);
      const rendered = await this.render(job.template, variables);
      const attachments = (await this.attachments?.load(job.template, job.payload)) ?? [];
      return {
        to: job.recipientAddress,
        ...rendered,
        ...(attachments.length === 0 ? {} : { attachments }),
      };
    } catch (error) {
      if (error instanceof AttachmentUnavailable) {
        this.log?.error("email.attachment-unavailable", {
          emailJobId: job.id,
          reason: error.message,
        });
      }
      return null;
    }
  }
}

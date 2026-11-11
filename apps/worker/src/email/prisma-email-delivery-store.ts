import type { HeatClient } from "@heat/db";
import type { EmailDeliveryStore, EmailJobSnapshot } from "./email-delivery";

export class PrismaEmailDeliveryStore implements EmailDeliveryStore {
  constructor(private readonly database: HeatClient) {}

  async load(id: string): Promise<EmailJobSnapshot | null> {
    const job = await this.database.emailJob.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        template: true,
        recipientAddress: true,
        outbox: { select: { payload: true } },
        user: { select: { profile: { select: { name: true } } } },
      },
    });
    if (job === null) return null;
    return {
      id: job.id,
      status: job.status,
      template: job.template,
      recipientAddress: job.recipientAddress,
      recipientName: job.user?.profile?.name ?? null,
      payload: job.outbox?.payload ?? null,
    };
  }

  async markSending(id: string): Promise<void> {
    await this.database.emailJob.update({
      where: { id },
      data: { status: "SENDING", attempts: { increment: 1 } },
    });
  }

  async markDelayed(id: string, smtpResponse: string | null): Promise<void> {
    await this.database.emailJob.update({
      where: { id },
      data: { status: "DELAYED", smtpResponse },
    });
  }

  async markSent(id: string, smtpResponse: string, at: Date): Promise<void> {
    await this.database.emailJob.update({
      where: { id },
      data: { status: "SENT", smtpResponse, sentAt: at },
    });
  }

  async markFailed(id: string, smtpResponse: string | null, at: Date): Promise<void> {
    await this.database.emailJob.update({
      where: { id },
      data: { status: "FAILED", smtpResponse, failedAt: at },
    });
  }
}

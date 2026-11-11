import type { HeatClient } from "@heat/db";
import type { OutboxEvent, OutboxStore, RelayTransaction } from "./outbox-relay";

interface ClaimedRow {
  id: string;
  eventType: string;
  payload: unknown;
  createdAt: Date;
}

const transactionTimeoutMs = 15000;

export class PrismaOutboxStore implements OutboxStore {
  constructor(private readonly database: HeatClient) {}

  relayNext(
    work: (event: OutboxEvent, transaction: RelayTransaction) => Promise<void>,
    now: () => Date,
  ): Promise<boolean> {
    return this.database.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<ClaimedRow[]>`
          SELECT "id", "eventType", "payload", "createdAt"
          FROM "Outbox"
          WHERE "processedAt" IS NULL
          ORDER BY "createdAt", "id"
          LIMIT 1
          FOR UPDATE SKIP LOCKED`;
        const row = rows[0];
        if (row === undefined) return false;

        await work(row, {
          findRecipientAddress: async (userId) => {
            const user = await tx.user.findFirst({
              where: { id: userId, deletedAt: null },
              select: { email: true },
            });
            return user?.email ?? null;
          },
          recordEmailJob: async (job) => {
            await tx.emailJob.createMany({
              data: [
                {
                  id: job.id,
                  outboxId: job.outboxId,
                  userId: job.userId,
                  recipientAddress: job.recipientAddress,
                  category: job.category,
                  template: job.template,
                },
              ],
              skipDuplicates: true,
            });
          },
          createNotification: async (notification) => {
            await tx.notification.create({
              data: {
                userId: notification.userId,
                type: notification.type,
                data: notification.data,
              },
            });
          },
        });

        await tx.outbox.update({ where: { id: row.id }, data: { processedAt: now() } });
        return true;
      },
      { timeout: transactionTimeoutMs },
    );
  }

  async oldestUnrelayedAt(): Promise<Date | null> {
    const oldest = await this.database.outbox.findFirst({
      where: { processedAt: null },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    return oldest?.createdAt ?? null;
  }
}

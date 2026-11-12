import { Inject, Injectable } from "@nestjs/common";
import type {
  MarkAllNotificationsReadResponse,
  NotificationData,
  NotificationItem,
  NotificationListQuery,
  NotificationListResponse,
  NotificationTypeName,
  UnreadNotificationCount,
} from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { CLOCK, DATABASE } from "../core";
import type { Clock } from "../core";
import { ApiException } from "../http/api-exception";

export const notificationRetentionDays = 180;

const dayMilliseconds = 24 * 60 * 60 * 1000;

export type NotificationWriter = Pick<HeatClient, "notification" | "user" | "enrollment">;

export interface NewNotification {
  userId: string;
  type: NotificationTypeName;
  data: NotificationData;
}

const itemSelect = { id: true, type: true, data: true, readAt: true, createdAt: true } as const;

interface NotificationRow {
  id: string;
  type: NotificationTypeName;
  data: unknown;
  readAt: Date | null;
  createdAt: Date;
}

const toItem = (row: NotificationRow): NotificationItem => ({
  id: row.id,
  type: row.type,
  data: row.data as NotificationData,
  readAt: row.readAt === null ? null : row.readAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
});

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async createWithin(tx: NotificationWriter, notification: NewNotification): Promise<boolean> {
    const active = await tx.user.count({ where: { id: notification.userId, deletedAt: null } });
    if (active === 0) return false;
    await tx.notification.create({
      data: {
        userId: notification.userId,
        type: notification.type,
        data: notification.data,
      },
    });
    return true;
  }

  async createForApprovedStudents(
    tx: NotificationWriter,
    type: NotificationTypeName,
    data: NotificationData,
  ): Promise<number> {
    const recipients = await tx.enrollment.findMany({
      where: {
        status: { in: ["APPROVED", "COMPLETED"] },
        deletedAt: null,
        user: { deletedAt: null },
      },
      select: { userId: true },
      distinct: ["userId"],
    });
    if (recipients.length === 0) return 0;
    await tx.notification.createMany({
      data: recipients.map(({ userId }) => ({ userId, type, data })),
    });
    return recipients.length;
  }

  async list(userId: string, query: NotificationListQuery): Promise<NotificationListResponse> {
    const where = { userId };
    const [rows, total] = await Promise.all([
      this.database.notification.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: itemSelect,
      }),
      this.database.notification.count({ where }),
    ]);
    return { items: rows.map(toItem), total, page: query.page, pageSize: query.pageSize };
  }

  async unreadCount(userId: string): Promise<UnreadNotificationCount> {
    const count = await this.database.notification.count({ where: { userId, readAt: null } });
    return { count };
  }

  async markRead(userId: string, id: string): Promise<NotificationItem> {
    await this.database.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: this.clock.now() },
    });
    const row = await this.database.notification.findFirst({
      where: { id, userId },
      select: itemSelect,
    });
    if (row === null) throw new ApiException(404, "NOT_FOUND");
    return toItem(row);
  }

  async markAllRead(userId: string): Promise<MarkAllNotificationsReadResponse> {
    const result = await this.database.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: this.clock.now() },
    });
    return { updated: result.count };
  }

  async purgeReadOlderThanRetention(): Promise<number> {
    const cutoff = new Date(
      this.clock.now().getTime() - notificationRetentionDays * dayMilliseconds,
    );
    const result = await this.database.notification.deleteMany({
      where: { readAt: { not: null }, createdAt: { lt: cutoff } },
    });
    return result.count;
  }
}

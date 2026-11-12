import {
  markAllNotificationsReadResponseSchema,
  notificationListQuerySchema,
  notificationListResponseSchema,
  notificationSchema,
  unreadNotificationCountSchema,
} from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class NotificationListQueryDto extends createZodDto(notificationListQuerySchema) {}
export class NotificationListResponseDto extends createZodDto(notificationListResponseSchema) {}
export class NotificationDto extends createZodDto(notificationSchema) {}
export class UnreadNotificationCountDto extends createZodDto(unreadNotificationCountSchema) {}
export class MarkAllNotificationsReadResponseDto extends createZodDto(
  markAllNotificationsReadResponseSchema,
) {}

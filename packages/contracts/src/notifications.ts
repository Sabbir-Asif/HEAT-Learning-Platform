import { z } from "zod";

export const notificationTypes = [
  "ENROLLMENT_APPROVED",
  "ENROLLMENT_REJECTED",
  "ENROLLMENT_REMOVED",
  "ENROLLMENT_REINSTATED",
  "CERTIFICATE_READY",
  "NEWS_PUBLISHED",
] as const;

export const notificationTypeSchema = z.enum(notificationTypes);

export type NotificationTypeName = z.infer<typeof notificationTypeSchema>;

export const notificationPageSizeMax = 50;
export const notificationLabelMaxLength = 200;

export const notificationDataSchema = z.record(
  z.string().max(64),
  z.string().max(notificationLabelMaxLength),
);

export type NotificationData = z.infer<typeof notificationDataSchema>;

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(notificationPageSizeMax).default(20),
});

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;

export const notificationSchema = z.object({
  id: z.uuid(),
  type: notificationTypeSchema,
  data: notificationDataSchema,
  readAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export type NotificationItem = z.infer<typeof notificationSchema>;

export const notificationListResponseSchema = z.object({
  items: z.array(notificationSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export type NotificationListResponse = z.infer<typeof notificationListResponseSchema>;

export const unreadNotificationCountSchema = z.object({
  count: z.number().int().min(0),
});

export type UnreadNotificationCount = z.infer<typeof unreadNotificationCountSchema>;

export const markAllNotificationsReadResponseSchema = z.object({
  updated: z.number().int().min(0),
});

export type MarkAllNotificationsReadResponse = z.infer<
  typeof markAllNotificationsReadResponseSchema
>;

import type { NotificationItem, NotificationTypeName } from "@heat/contracts";

export interface NotificationRowModel {
  id: string;
  title: string;
  description?: string;
  timeLabel: string;
  unread: boolean;
}

const copy: Record<NotificationTypeName, { title: string; description: string }> = {
  ENROLLMENT_APPROVED: {
    title: "Your enrollment was approved",
    description: "You can start the course now.",
  },
  ENROLLMENT_REJECTED: {
    title: "Your enrollment request was not approved",
    description: "Check your email for the reason and how to apply again.",
  },
  ENROLLMENT_REMOVED: {
    title: "Your enrollment was removed",
    description: "Your progress is kept if you are reinstated.",
  },
  ENROLLMENT_REINSTATED: {
    title: "Your enrollment was reinstated",
    description: "You can continue where you left off.",
  },
  CERTIFICATE_READY: {
    title: "Your certificate is ready",
    description: "Open Certificates to view or download it.",
  },
  NEWS_PUBLISHED: {
    title: "New announcement",
    description: "A new post was published.",
  },
};

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Dhaka",
});

export const formatNotificationTime = (iso: string): string => timeFormat.format(new Date(iso));

export const toNotificationRowModel = (item: NotificationItem): NotificationRowModel => {
  const { title, description } = copy[item.type];
  const label = item.data.title;
  return {
    id: item.id,
    title: item.type === "NEWS_PUBLISHED" && label ? label : title,
    description: item.type === "NEWS_PUBLISHED" && label ? "New announcement" : description,
    timeLabel: formatNotificationTime(item.createdAt),
    unread: item.readAt === null,
  };
};

export const unreadPollIntervalMilliseconds = 60_000;

export const unreadPollInterval = (visible: boolean): number | false =>
  visible ? unreadPollIntervalMilliseconds : false;

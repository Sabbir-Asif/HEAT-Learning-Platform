import type { NotificationItem } from "@heat/contracts";
import { describe, expect, test } from "vitest";
import {
  toNotificationRowModel,
  unreadPollInterval,
  unreadPollIntervalMilliseconds,
} from "../../src/notifications/notification-view";

const item = (overrides: Partial<NotificationItem> = {}): NotificationItem => ({
  id: "0198f1a0-0000-7000-8000-0000000000a1",
  type: "ENROLLMENT_APPROVED",
  data: {},
  readAt: null,
  createdAt: "2026-11-12T04:00:00.000Z",
  ...overrides,
});

describe("toNotificationRowModel", () => {
  test("renders text from the type", () => {
    const model = toNotificationRowModel(item({ type: "CERTIFICATE_READY" }));
    expect(model.title).toBe("Your certificate is ready");
    expect(model.unread).toBe(true);
  });

  test("formats the time in Asia/Dhaka", () => {
    expect(toNotificationRowModel(item()).timeLabel).toBe("12 November 2026 at 10:00");
  });

  test("marks a read notification as read", () => {
    const model = toNotificationRowModel(item({ readAt: "2026-11-12T05:00:00.000Z" }));
    expect(model.unread).toBe(false);
  });

  test("uses the post title for news when present", () => {
    const model = toNotificationRowModel(
      item({ type: "NEWS_PUBLISHED", data: { title: "Exam schedule" } }),
    );
    expect(model.title).toBe("Exam schedule");
  });

  test("renders text for profile change decisions", () => {
    expect(toNotificationRowModel(item({ type: "PROFILE_CHANGE_APPROVED" })).title).toBe(
      "Your profile change was approved",
    );
    expect(toNotificationRowModel(item({ type: "PROFILE_CHANGE_REJECTED" })).title).toBe(
      "Your profile change was not approved",
    );
  });

  test("falls back to generic news text without a title", () => {
    const model = toNotificationRowModel(item({ type: "NEWS_PUBLISHED" }));
    expect(model.title).toBe("New announcement");
  });
});

describe("unreadPollInterval", () => {
  test("polls every 60 seconds while visible and never while hidden", () => {
    expect(unreadPollInterval(true)).toBe(unreadPollIntervalMilliseconds);
    expect(unreadPollIntervalMilliseconds).toBe(60_000);
    expect(unreadPollInterval(false)).toBe(false);
  });
});

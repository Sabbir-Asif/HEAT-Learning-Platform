import type { NotificationItem } from "@heat/contracts";
import { act } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { NotificationsScreen } from "../../src/notifications/notifications-screen";
import { mount } from "../learn/mount";

const useNotificationsList = vi.fn();
const markRead = vi.fn();
const markAllRead = vi.fn();

vi.mock("@heat/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@heat/api-client")>()),
  useNotificationsList: (...args: unknown[]) => useNotificationsList(...args),
  useNotificationsMarkRead: () => ({ mutate: markRead, isPending: false, variables: undefined }),
  useNotificationsMarkAllRead: () => ({ mutate: markAllRead, isPending: false }),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

beforeEach(() => {
  useNotificationsList.mockReset();
  markRead.mockReset();
  markAllRead.mockReset();
});

const id = "0198f1a0-0000-7000-8000-0000000000a1";

const item = (overrides: Partial<NotificationItem> = {}): NotificationItem => ({
  id,
  type: "ENROLLMENT_APPROVED",
  data: {},
  readAt: null,
  createdAt: "2026-11-12T04:00:00.000Z",
  ...overrides,
});

const loaded = (items: NotificationItem[], total = items.length) =>
  useNotificationsList.mockReturnValue({
    isPending: false,
    isError: false,
    data: { items, total, page: 1, pageSize: 20 },
  });

const click = async (element: Element | null) => {
  await act(async () => (element as HTMLElement).click());
};

const button = (view: HTMLElement, name: string) =>
  [...view.querySelectorAll("button")].find((candidate) => candidate.textContent === name) ?? null;

describe("NotificationsScreen", () => {
  test("shows a loading state", async () => {
    useNotificationsList.mockReturnValue({ isPending: true, isError: false });
    const view = await mount(<NotificationsScreen />);
    expect(view.querySelector('[data-slot="notifications-loading"]')).not.toBeNull();
  });

  test("shows an error state that retries", async () => {
    const refetch = vi.fn();
    useNotificationsList.mockReturnValue({ isPending: false, isError: true, refetch });
    const view = await mount(<NotificationsScreen />);
    await click(button(view, "Retry"));
    expect(refetch).toHaveBeenCalled();
  });

  test("shows an empty state", async () => {
    loaded([]);
    const view = await mount(<NotificationsScreen />);
    expect(view.textContent).toContain("No notifications yet");
  });

  test("lists notifications and marks one read", async () => {
    loaded([item()]);
    const view = await mount(<NotificationsScreen />);
    expect(view.textContent).toContain("Your enrollment was approved");
    await click(button(view, "Mark as read"));
    expect(markRead).toHaveBeenCalledWith({ id });
  });

  test("marks all read", async () => {
    loaded([item()]);
    const view = await mount(<NotificationsScreen />);
    await click(button(view, "Mark all as read"));
    expect(markAllRead).toHaveBeenCalledTimes(1);
  });

  test("disables mark all when nothing is unread", async () => {
    loaded([item({ readAt: "2026-11-12T05:00:00.000Z" })]);
    const view = await mount(<NotificationsScreen />);
    expect(button(view, "Mark all as read")?.disabled).toBe(true);
  });

  test("pages through the list", async () => {
    loaded([item()], 45);
    const view = await mount(<NotificationsScreen />);
    expect(view.textContent).toContain("Page 1 of 3");
    await click(button(view, "Next"));
    expect(useNotificationsList.mock.lastCall?.[0]).toEqual({ page: 2, pageSize: 20 });
  });
});

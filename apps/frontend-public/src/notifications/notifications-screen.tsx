"use client";

import {
  getNotificationsListQueryKey,
  getNotificationsUnreadCountQueryKey,
  useNotificationsList,
  useNotificationsMarkAllRead,
  useNotificationsMarkRead,
  useNotificationsUnreadCount,
} from "@heat/api-client";
import { Button, NotificationRow, PageHeader, toast } from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { notificationsPageSize } from "./notifications-page-size";
import { toNotificationRowModel } from "./notification-view";
import {
  NotificationsEmpty,
  NotificationsError,
  NotificationsLoading,
} from "./notifications-states";

export function NotificationsScreen() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const list = useNotificationsList(
    { page, pageSize: notificationsPageSize },
    { query: { placeholderData: keepPreviousData } },
  );
  const unread = useNotificationsUnreadCount();
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getNotificationsListQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getNotificationsUnreadCountQueryKey() }),
    ]);
  };
  const failed = () => toast.error("That did not work. Try again.");
  const markRead = useNotificationsMarkRead({
    mutation: { onSuccess: refresh, onError: failed },
  });
  const markAllRead = useNotificationsMarkAllRead({
    mutation: { onSuccess: refresh, onError: failed },
  });

  if (list.isPending) return <NotificationsLoading />;
  if (list.isError) return <NotificationsError onRetry={() => void list.refetch()} />;
  const { items, total } = list.data;
  if (total === 0) return <NotificationsEmpty />;

  const models = items.map(toNotificationRowModel);
  const pageCount = Math.max(1, Math.ceil(total / notificationsPageSize));
  const hasUnread = (unread.data?.count ?? 0) > 0;
  return (
    <ShellContent>
      <PageHeader
        title="Notifications"
        action={
          <Button
            variant="outline"
            disabled={markAllRead.isPending || !hasUnread}
            onClick={() => markAllRead.mutate()}
          >
            Mark all as read
          </Button>
        }
      />
      <ul className="flex max-w-3xl flex-col gap-3">
        {models.map(({ id, ...row }) => (
          <NotificationRow
            key={id}
            {...row}
            markReadPending={markRead.isPending && markRead.variables?.id === id}
            onMarkRead={() => markRead.mutate({ id })}
          />
        ))}
      </ul>
      {pageCount > 1 ? (
        <nav aria-label="Notification pages" className="flex items-center justify-between gap-2">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span>
            Page {page} of {pageCount}
          </span>
          <Button variant="outline" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </nav>
      ) : null}
    </ShellContent>
  );
}

"use client";

import { useNotificationsUnreadCount } from "@heat/api-client";
import { useEffect, useRef } from "react";
import { unreadPollInterval } from "./notification-view";
import { usePageVisible } from "./use-page-visible";

export const useUnreadCount = (): number => {
  const visible = usePageVisible();
  const unread = useNotificationsUnreadCount({
    query: { refetchInterval: unreadPollInterval(visible), refetchIntervalInBackground: false },
  });
  const wasVisible = useRef(visible);
  const { refetch } = unread;
  useEffect(() => {
    if (visible && !wasVisible.current) void refetch();
    wasVisible.current = visible;
  }, [visible, refetch]);
  return unread.data?.count ?? 0;
};

import "server-only";
import { getNotificationsListUrl, notificationsList } from "@heat/api-client/server";
import { QueryClient, dehydrate } from "@tanstack/react-query";
import type { DehydratedState } from "@tanstack/react-query";
import { notificationsPageSize } from "./notifications-page-size";
import { verifySession } from "../auth/session";

export async function loadNotificationsPage(): Promise<DehydratedState> {
  await verifySession();
  const params = { page: 1, pageSize: notificationsPageSize };
  const notifications = await notificationsList(params);
  const client = new QueryClient();
  client.setQueryData([getNotificationsListUrl(), params], notifications);
  return dehydrate(client);
}

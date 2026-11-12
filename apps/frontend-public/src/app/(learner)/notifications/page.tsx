import { HydrationBoundary } from "@tanstack/react-query";
import { NotificationsScreen } from "@/notifications/notifications-screen";
import { loadNotificationsPage } from "@/notifications/notifications-page-data";

export default async function Page() {
  const state = await loadNotificationsPage();
  return (
    <HydrationBoundary state={state}>
      <NotificationsScreen />
    </HydrationBoundary>
  );
}

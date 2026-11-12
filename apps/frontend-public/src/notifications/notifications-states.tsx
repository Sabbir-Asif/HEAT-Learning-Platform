import { EmptyState, ErrorState, PageHeader, Skeleton } from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { BellIcon } from "lucide-react";

export function NotificationsLoading() {
  return (
    <ShellContent aria-busy="true" data-slot="notifications-loading">
      <p role="status" className="sr-only">
        Loading
      </p>
      <Skeleton className="h-8 w-1/3" />
      <div className="grid gap-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    </ShellContent>
  );
}

export function NotificationsError({ onRetry }: { onRetry: () => void }) {
  return (
    <ShellContent>
      <PageHeader title="Notifications" />
      <ErrorState onRetry={onRetry} />
    </ShellContent>
  );
}

export function NotificationsEmpty() {
  return (
    <ShellContent>
      <PageHeader title="Notifications" />
      <EmptyState
        icon={BellIcon}
        title="No notifications yet"
        description="Updates about your enrollment, certificates and announcements appear here."
      />
    </ShellContent>
  );
}

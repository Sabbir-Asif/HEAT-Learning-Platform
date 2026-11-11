import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { BookOpenIcon } from "lucide-react";
import Link from "next/link";

export function DashboardLoading() {
  return (
    <ShellContent aria-busy="true" data-slot="dashboard-loading">
      <p role="status" className="sr-only">
        Loading
      </p>
      <Skeleton className="h-8 w-1/3" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </ShellContent>
  );
}

export function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <ShellContent>
      <PageHeader title="My learning" />
      <ErrorState onRetry={onRetry} />
    </ShellContent>
  );
}

export function DashboardEmpty() {
  return (
    <ShellContent>
      <PageHeader title="My learning" />
      <EmptyState
        icon={BookOpenIcon}
        title="No courses yet"
        description="Courses you enrol in appear here."
        action={
          <Button variant="outline" nativeButton={false} render={<Link href="/courses" />}>
            Browse courses
          </Button>
        }
      />
    </ShellContent>
  );
}

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusBadge,
} from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { LockIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { courseHref } from "./learning-view";
import type { EnrollmentNotice } from "./learning-view";

export function LearnLoading() {
  return (
    <ShellContent aria-busy="true" data-slot="learn-loading">
      <p role="status" className="sr-only">
        Loading
      </p>
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </ShellContent>
  );
}

export function LearnError({ onRetry }: { onRetry?: () => void }) {
  return (
    <ShellContent>
      <ErrorState onRetry={onRetry} />
    </ShellContent>
  );
}

export function EnrollmentNoticeView({
  courseTitle,
  notice,
}: {
  courseTitle: string;
  notice: EnrollmentNotice;
}) {
  return (
    <ShellContent>
      <PageHeader
        title={courseTitle}
        action={<StatusBadge kind="enrollment" status={notice.status} />}
      />
      <Card>
        <CardContent className="flex flex-col gap-3">
          <CardDescription role="status">{notice.description}</CardDescription>
          {notice.reason === null ? null : <p>Reason: {notice.reason}</p>}
          <div>
            <Button variant="outline" nativeButton={false} render={<Link href="/dashboard" />}>
              Go to dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </ShellContent>
  );
}

export function LockedModuleView({
  courseSlug,
  moduleTitle,
  reason,
}: {
  courseSlug: string;
  moduleTitle: string;
  reason: string;
}) {
  return (
    <ShellContent>
      <PageHeader title={moduleTitle} />
      <EmptyState
        icon={LockIcon}
        title="This module is locked"
        description={reason}
        action={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={courseHref(courseSlug)} />}
          >
            Back to the course
          </Button>
        }
      />
    </ShellContent>
  );
}

export function MissingModuleView({ courseSlug }: { courseSlug: string }) {
  return (
    <ShellContent>
      <EmptyState
        icon={SearchXIcon}
        title="Module not found"
        description="This module is not part of your course."
        action={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={courseHref(courseSlug)} />}
          >
            Back to the course
          </Button>
        }
      />
    </ShellContent>
  );
}

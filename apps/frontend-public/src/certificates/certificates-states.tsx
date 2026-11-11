import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { AwardIcon } from "lucide-react";
import Link from "next/link";

export function CertificatesLoading() {
  return (
    <ShellContent aria-busy="true" data-slot="certificates-loading">
      <p role="status" className="sr-only">
        Loading
      </p>
      <Skeleton className="h-8 w-1/3" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    </ShellContent>
  );
}

export function CertificatesError({ onRetry }: { onRetry: () => void }) {
  return (
    <ShellContent>
      <PageHeader title="Certificates" />
      <ErrorState onRetry={onRetry} />
    </ShellContent>
  );
}

export function CertificatesEmpty() {
  return (
    <ShellContent>
      <PageHeader title="Certificates" />
      <EmptyState
        icon={AwardIcon}
        title="No certificates yet"
        description="You receive a certificate when you complete a course."
        action={
          <Button variant="outline" nativeButton={false} render={<Link href="/dashboard" />}>
            Go to my learning
          </Button>
        }
      />
    </ShellContent>
  );
}

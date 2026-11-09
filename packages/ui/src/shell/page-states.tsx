import { ErrorState } from "../composites/error-state";
import { Skeleton } from "../components/skeleton";
import { ShellContent } from "./skip-link";

function PageLoading() {
  return (
    <ShellContent aria-busy="true" data-slot="page-loading">
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

function PageError({ onRetry }: { onRetry?: () => void }) {
  return (
    <ShellContent data-slot="page-error">
      <ErrorState onRetry={onRetry} />
    </ShellContent>
  );
}

export { PageError, PageLoading };

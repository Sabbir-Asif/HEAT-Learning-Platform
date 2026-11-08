import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "../components/button";
import { cn } from "../lib/utils";

type ErrorStateProps = Omit<React.ComponentProps<"div">, "title"> & {
  title?: string;
  description?: string;
  onRetry?: () => void;
};

function ErrorState({
  title = "Something went wrong",
  description = "This could not be loaded. Try again.",
  onRetry,
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      data-slot="error-state"
      role="alert"
      className={cn("flex flex-col items-center gap-3 px-4 py-10 text-center", className)}
      {...props}
    >
      <TriangleAlertIcon aria-hidden="true" className="text-destructive size-5" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          <RotateCcwIcon data-icon="inline-start" />
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export { ErrorState };
export type { ErrorStateProps };

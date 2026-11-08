import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";

type EmptyStateProps = Omit<React.ComponentProps<"div">, "title"> & {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn("flex flex-col items-center gap-3 px-4 py-10 text-center", className)}
      {...props}
    >
      <Icon aria-hidden="true" className="text-muted-foreground size-5" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium break-words">{title}</p>
        {description ? (
          <p className="text-muted-foreground text-sm break-words">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export { EmptyState };
export type { EmptyStateProps };

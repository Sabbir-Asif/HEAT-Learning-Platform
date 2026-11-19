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
      className={cn("flex flex-col items-center gap-4 px-4 py-12 text-center", className)}
      {...props}
    >
      <span
        aria-hidden="true"
        className="bg-accent text-accent-foreground grid size-14 place-items-center rounded-full"
      >
        <Icon className="size-6" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-heading text-secondary-foreground text-lg font-semibold break-words">
          {title}
        </p>
        {description ? (
          <p className="text-muted-foreground max-w-md text-sm break-words">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export { EmptyState };
export type { EmptyStateProps };

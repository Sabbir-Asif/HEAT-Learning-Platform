import { cn } from "../lib/utils";
import { Button } from "../components/button";

type NotificationRowProps = Omit<React.ComponentProps<"li">, "title"> & {
  title: string;
  description?: string;
  timeLabel: string;
  unread: boolean;
  onMarkRead?: () => void;
  markReadPending?: boolean;
};

function NotificationRow({
  title,
  description,
  timeLabel,
  unread,
  onMarkRead,
  markReadPending = false,
  className,
  ...props
}: NotificationRowProps) {
  return (
    <li
      data-slot="notification-row"
      data-unread={unread ? "true" : "false"}
      className={cn(
        "border-border flex items-start gap-3 border-b px-1 py-4 last:border-b-0",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          unread ? "bg-primary" : "bg-transparent",
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className={cn("text-sm break-words", unread ? "font-semibold" : "font-medium")}>
          {unread ? <span className="sr-only">Unread: </span> : null}
          {title}
        </p>
        {description ? (
          <p className="text-muted-foreground text-sm break-words">{description}</p>
        ) : null}
        <p className="text-muted-foreground text-xs">{timeLabel}</p>
      </div>
      {unread && onMarkRead ? (
        <Button variant="ghost" size="sm" disabled={markReadPending} onClick={onMarkRead}>
          Mark as read
        </Button>
      ) : null}
    </li>
  );
}

export { NotificationRow };
export type { NotificationRowProps };

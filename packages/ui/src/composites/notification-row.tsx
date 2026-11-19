import { BellIcon, BellRingIcon } from "lucide-react";
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
  const Icon = unread ? BellRingIcon : BellIcon;
  return (
    <li
      data-slot="notification-row"
      data-unread={unread ? "true" : "false"}
      className={cn(
        "bg-card ring-divider flex items-start gap-4 rounded-xl p-4 ring-1 transition-colors md:p-5",
        unread && "bg-accent/50 ring-primary/30",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full",
          unread ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className={cn("text-base break-words", unread ? "font-semibold" : "font-medium")}>
          {unread ? <span className="sr-only">Unread: </span> : null}
          {title}
        </p>
        {description ? (
          <p className="text-muted-foreground text-sm break-words">{description}</p>
        ) : null}
        <p className="text-muted-foreground text-xs">{timeLabel}</p>
      </div>
      {unread && onMarkRead ? (
        <Button variant="outline" size="sm" disabled={markReadPending} onClick={onMarkRead}>
          Mark as read
        </Button>
      ) : null}
    </li>
  );
}

export { NotificationRow };
export type { NotificationRowProps };

import { cn } from "../lib/utils";
import { Badge } from "../components/badge";
import { resolveStatus, type StatusKind, type StatusTone } from "./status";

const toneClasses: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground [&>svg]:text-muted-foreground",
  info: "bg-status-info text-status-info-foreground [&>svg]:text-status-info-mark",
  success: "bg-status-success text-status-success-foreground [&>svg]:text-status-success-mark",
  warning: "bg-status-warning text-status-warning-foreground [&>svg]:text-status-warning-mark",
  danger: "bg-status-danger text-status-danger-foreground [&>svg]:text-status-danger-mark",
  brand: "bg-status-brand text-status-brand-foreground [&>svg]:text-status-brand-mark",
};

type StatusBadgeProps = Omit<React.ComponentProps<typeof Badge>, "variant" | "children"> & {
  kind: StatusKind;
  status: string;
};

function StatusBadge({ kind, status, className, ...props }: StatusBadgeProps) {
  const entry = resolveStatus(kind, status);
  const Icon = entry.icon;
  return (
    <Badge
      data-slot="status-badge"
      data-tone={entry.tone}
      variant="ghost"
      className={cn(toneClasses[entry.tone], "hover:bg-inherit", className)}
      {...props}
    >
      <Icon aria-hidden="true" />
      {entry.label}
    </Badge>
  );
}

export { StatusBadge };
export type { StatusBadgeProps };

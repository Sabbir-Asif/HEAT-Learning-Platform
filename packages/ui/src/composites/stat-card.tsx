import { ArrowDownIcon, ArrowUpIcon, MinusIcon, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "../components/card";
import { cn } from "../lib/utils";

type StatTrend = {
  direction: "up" | "down" | "flat";
  text: string;
};

type StatCardProps = Omit<React.ComponentProps<typeof Card>, "children"> & {
  label: string;
  value: string;
  trend?: StatTrend;
  icon?: LucideIcon;
};

const trendIcons = { up: ArrowUpIcon, down: ArrowDownIcon, flat: MinusIcon };
const trendWords = { up: "Up", down: "Down", flat: "No change" };

function StatCard({ label, value, trend, icon: Icon, className, ...props }: StatCardProps) {
  const TrendIcon = trend ? trendIcons[trend.direction] : null;
  return (
    <Card
      data-slot="stat-card"
      className={cn("transition-shadow hover:shadow-md", className)}
      {...props}
    >
      <CardContent className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-muted-foreground text-sm font-medium">{label}</p>
          <p className="font-heading text-2xl leading-tight font-semibold break-words tabular-nums">
            {value}
          </p>
          {trend && TrendIcon ? (
            <p className="text-muted-foreground flex items-center gap-1 text-xs">
              <TrendIcon aria-hidden="true" className="size-3" />
              <span className="sr-only">{trendWords[trend.direction]}: </span>
              {trend.text}
            </p>
          ) : null}
        </div>
        {Icon ? (
          <span
            aria-hidden="true"
            className="bg-accent text-accent-foreground grid size-11 shrink-0 place-items-center rounded-xl"
          >
            <Icon className="size-5" />
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}

export { StatCard };
export type { StatCardProps, StatTrend };

import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react";
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
};

const trendIcons = { up: ArrowUpIcon, down: ArrowDownIcon, flat: MinusIcon };
const trendWords = { up: "Up", down: "Down", flat: "No change" };

function StatCard({ label, value, trend, className, ...props }: StatCardProps) {
  const TrendIcon = trend ? trendIcons[trend.direction] : null;
  return (
    <Card data-slot="stat-card" size="sm" className={cn(className)} {...props}>
      <CardContent className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className="font-heading text-2xl font-semibold tabular-nums">{value}</p>
        {trend && TrendIcon ? (
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <TrendIcon aria-hidden="true" className="size-3" />
            <span className="sr-only">{trendWords[trend.direction]}: </span>
            {trend.text}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export { StatCard };
export type { StatCardProps, StatTrend };

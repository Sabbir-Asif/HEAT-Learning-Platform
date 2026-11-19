import { cn } from "@heat/ui";

interface ProgressRingProps {
  percent: number;
  label: string;
  className?: string;
}

const radius = 36;
const circumference = 2 * Math.PI * radius;

export function ProgressRing({ percent, label, className }: ProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn("relative grid size-20 shrink-0 place-items-center", className)}
    >
      <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="40" cy="40" r={radius} fill="none" strokeWidth="7" className="stroke-muted" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className="stroke-primary transition-[stroke-dashoffset]"
        />
      </svg>
      <span aria-hidden="true" className="font-heading absolute text-lg font-semibold tabular-nums">
        {clamped}%
      </span>
    </div>
  );
}

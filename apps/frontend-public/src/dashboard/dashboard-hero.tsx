import { AwardIcon, BookOpenIcon, CheckCheckIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface DashboardTotals {
  courses: number;
  modulesCompleted: number;
  certificates: number;
}

const today = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Asia/Dhaka",
});

const firstNameOf = (name: string | undefined): string | null => {
  const first = name?.trim().split(/\s+/)[0];
  return first === undefined || first === "" ? null : first;
};

function Tally({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  return (
    <div className="flex flex-1 items-center gap-3 px-5 py-4">
      <span
        aria-hidden="true"
        className="bg-accent text-accent-foreground grid size-10 shrink-0 place-items-center rounded-full"
      >
        <Icon className="size-5" />
      </span>
      <p className="flex flex-col leading-tight">
        <span className="font-heading text-2xl font-semibold tabular-nums">{value}</span>
        <span className="text-muted-foreground text-xs whitespace-nowrap">{label}</span>
      </p>
    </div>
  );
}

export function DashboardHero({ name, totals }: { name?: string; totals: DashboardTotals }) {
  const first = firstNameOf(name);
  return (
    <header className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
          {today.format(new Date())}
        </p>
        <h1 className="font-display text-4xl leading-tight tracking-tight text-balance md:text-5xl">
          {first === null ? "Welcome back" : `Welcome back, ${first}`}
        </h1>
        <p className="text-muted-foreground max-w-xl text-base text-pretty">
          Pick up where you left off. Every module you finish brings you closer to your certificate.
        </p>
      </div>
      <dl
        aria-label="Your learning at a glance"
        className="bg-card ring-divider divide-divider flex divide-x rounded-xl ring-1 max-sm:flex-col max-sm:divide-x-0 max-sm:divide-y"
      >
        <Tally icon={BookOpenIcon} value={totals.courses} label="Courses" />
        <Tally icon={CheckCheckIcon} value={totals.modulesCompleted} label="Modules done" />
        <Tally icon={AwardIcon} value={totals.certificates} label="Certificates" />
      </dl>
    </header>
  );
}

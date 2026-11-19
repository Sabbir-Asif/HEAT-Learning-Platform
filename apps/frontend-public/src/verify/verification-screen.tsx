import { Button } from "@heat/ui";
import { BadgeCheckIcon, ShieldAlertIcon } from "lucide-react";
import Link from "next/link";
import type { VerificationModel } from "./verification-view";

export function VerificationScreen({ model }: { model: VerificationModel }) {
  const Icon = model.valid ? BadgeCheckIcon : ShieldAlertIcon;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12 md:px-6 md:py-16">
      <div className="bg-card ring-divider flex flex-col gap-6 rounded-xl p-6 shadow-sm ring-1 md:p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <span
            className={
              model.valid
                ? "bg-accent text-accent-foreground grid size-14 place-items-center rounded-xl"
                : "bg-destructive/10 text-destructive grid size-14 place-items-center rounded-xl"
            }
          >
            <Icon aria-hidden="true" className="size-7" />
          </span>
          <h1 className="font-display text-3xl font-bold tracking-tight text-balance">
            {model.heading}
          </h1>
          <p
            role={model.valid ? "status" : "alert"}
            className="text-muted-foreground max-w-md text-sm text-pretty"
          >
            {model.note}
          </p>
        </div>
        <dl className="divide-border/60 border-border/60 divide-y border-t">
          {model.rows.map((row) => (
            <div key={row.label} className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6">
              <dt className="text-muted-foreground w-32 shrink-0 text-sm font-medium">
                {row.label}
              </dt>
              <dd className="font-medium break-words">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <Button
        variant="outline"
        className="self-center"
        nativeButton={false}
        render={<Link href="/verify" />}
      >
        Verify another certificate
      </Button>
    </div>
  );
}

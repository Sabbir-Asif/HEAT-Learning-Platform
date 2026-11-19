import type { LucideIcon } from "lucide-react";
import { linkElement } from "./link";
import { ShellMain, SkipLink } from "./skip-link";
import { ThemedLogo } from "./themed-logo";
import type { LogoSource, ShellLink } from "./types";

interface AuthPanelPoint {
  icon: LucideIcon;
  label: string;
}

interface AuthLayoutProps {
  brand: { name: string; href: string; logos?: ReadonlyArray<LogoSource> };
  panel: { headline: string; points: ReadonlyArray<AuthPanelPoint>; image?: React.ReactNode };
  actions?: React.ReactNode;
  link?: ShellLink;
  children: React.ReactNode;
}

function AuthLayout({ brand, panel, actions, link, children }: AuthLayoutProps) {
  return (
    <div
      data-slot="auth-layout"
      className="bg-sidebar text-sidebar-foreground from-sidebar via-sidebar to-sidebar-accent/60 relative isolate flex min-h-svh flex-col overflow-hidden bg-linear-to-br"
    >
      <SkipLink />
      {panel.image ? (
        <div aria-hidden="true" className="absolute inset-0 -z-10 [&>img]:object-cover">
          {panel.image}
        </div>
      ) : null}
      <span
        aria-hidden="true"
        className="from-sidebar/80 via-sidebar/60 to-sidebar/85 absolute inset-0 -z-10 bg-linear-to-b"
      />
      <header className="flex items-center justify-between gap-2 px-4 py-5 md:px-12">
        {linkElement(link, {
          href: brand.href,
          className:
            "focus-visible:ring-ring flex min-w-0 items-center gap-3 rounded-md outline-hidden focus-visible:ring-2",
          children: (
            <>
              {(brand.logos ?? []).map((logo) => (
                <ThemedLogo key={logo.src} {...logo} eager className="h-10" />
              ))}
              <span className="font-display truncate text-lg font-semibold">{brand.name}</span>
            </>
          ),
        })}
        {actions}
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 pt-4 pb-12 md:px-12">
        <p className="font-display text-heading-1 hidden max-w-2xl text-center text-balance md:block">
          {panel.headline}
        </p>
        <ShellMain className="bg-card/55 text-card-foreground ring-card/40 [&_.text-muted-foreground]:text-foreground/75 [&_[data-slot=input-group]]:bg-background/40 [&_[data-slot=input]]:bg-background/40 [&_[data-slot=select-trigger]]:bg-background/40 flex w-full max-w-xl flex-none flex-col gap-6 rounded-xl p-6 shadow-2xl ring-1 backdrop-blur-2xl backdrop-saturate-150 md:p-10 [&_[data-slot=input-group]]:backdrop-blur-md [&_[data-slot=input]]:backdrop-blur-md [&_[data-slot=select-trigger]]:backdrop-blur-md">
          {children}
        </ShellMain>
        <ul
          aria-label="About the training"
          className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm"
        >
          {panel.points.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2">
              <span className="bg-sidebar-foreground/15 ring-sidebar-foreground/20 grid size-8 shrink-0 place-items-center rounded-xl ring-1 backdrop-blur-md">
                <Icon aria-hidden="true" className="text-sidebar-primary size-4" />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export { AuthLayout };
export type { AuthLayoutProps, AuthPanelPoint };

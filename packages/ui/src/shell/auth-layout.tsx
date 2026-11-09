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
  brand: { name: string; href: string; logos: ReadonlyArray<LogoSource> };
  panel: { headline: string; points: ReadonlyArray<AuthPanelPoint> };
  actions?: React.ReactNode;
  link?: ShellLink;
  children: React.ReactNode;
}

function AuthLayout({ brand, panel, actions, link, children }: AuthLayoutProps) {
  return (
    <div data-slot="auth-layout" className="grid min-h-svh lg:grid-cols-2">
      <SkipLink />
      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between gap-2 px-4 py-4 md:px-12">
          {linkElement(link, {
            href: brand.href,
            className:
              "focus-visible:ring-ring flex min-w-0 items-center gap-3 rounded-md outline-hidden focus-visible:ring-2",
            children: (
              <>
                {brand.logos.map((logo) => (
                  <ThemedLogo key={logo.src} {...logo} eager className="h-10" />
                ))}
                <span className="font-display truncate text-base font-semibold">{brand.name}</span>
              </>
            ),
          })}
          {actions}
        </header>
        <ShellMain className="flex w-full max-w-lg flex-col gap-6 px-4 py-8 md:px-12">
          {children}
        </ShellMain>
      </div>
      <aside
        aria-label="About the training"
        className="bg-sidebar text-sidebar-foreground hidden flex-col justify-center gap-6 px-12 lg:flex"
      >
        <p className="font-display text-heading-1 max-w-xl">{panel.headline}</p>
        <ul className="flex flex-col gap-3">
          {panel.points.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3">
              <Icon aria-hidden="true" className="text-sidebar-primary size-5 shrink-0" />
              {label}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

export { AuthLayout };
export type { AuthLayoutProps, AuthPanelPoint };

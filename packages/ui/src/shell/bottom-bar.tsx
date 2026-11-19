import { cn } from "../lib/utils";
import { linkElement } from "./link";
import { findActiveHref, type NavItem } from "./nav";
import type { ShellLink } from "./types";

interface BottomBarProps {
  items: ReadonlyArray<NavItem>;
  pathname: string;
  label: string;
  link?: ShellLink;
}

function BottomBar({ items, pathname, label, link }: BottomBarProps) {
  const activeHref = findActiveHref(items, pathname);
  return (
    <nav
      aria-label={label}
      data-slot="bottom-bar"
      className="sticky bottom-0 z-20 px-3 pb-3 md:hidden"
    >
      <ul className="bg-card/60 ring-divider flex rounded-xl p-1.5 shadow-lg ring-1 backdrop-blur-xl">
        {items.map(({ href, label: itemLabel, icon: Icon }) => {
          const active = href === activeHref;
          return (
            <li key={href} className="min-w-0 flex-1">
              {linkElement(link, {
                href,
                "aria-current": active ? "page" : undefined,
                className: cn(
                  "focus-visible:ring-ring flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 text-center text-xs leading-tight outline-hidden transition-colors focus-visible:ring-2",
                  active ? "bg-accent text-primary font-semibold" : "text-muted-foreground",
                ),
                children: (
                  <>
                    <Icon aria-hidden="true" className="size-5" />
                    <span>{itemLabel}</span>
                  </>
                ),
              })}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export { BottomBar };
export type { BottomBarProps };

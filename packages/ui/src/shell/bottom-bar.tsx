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
      className="bg-background/90 border-border sticky bottom-0 z-20 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="flex">
        {items.map(({ href, label: itemLabel, icon: Icon }) => {
          const active = href === activeHref;
          return (
            <li key={href} className="min-w-0 flex-1">
              {linkElement(link, {
                href,
                "aria-current": active ? "page" : undefined,
                className: cn(
                  "focus-visible:ring-ring flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-xs outline-hidden focus-visible:ring-2 focus-visible:ring-inset",
                  active ? "text-primary font-semibold" : "text-muted-foreground",
                ),
                children: (
                  <>
                    <Icon aria-hidden="true" className="size-5" />
                    <span className="max-w-full truncate">{itemLabel}</span>
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

"use client";

import { MenuIcon } from "lucide-react";
import { useState } from "react";
import { Button, buttonVariants } from "../components/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../components/sheet";
import { cn } from "../lib/utils";
import { linkElement } from "./link";
import { findActiveHref, type NavItem } from "./nav";
import { ShellHeader } from "./skip-link";
import { ThemedLogo } from "./themed-logo";
import type { LogoSource, ShellLink } from "./types";

interface PublicHeaderProps {
  brand: { name: string; subtitle?: string; href: string; logos: ReadonlyArray<LogoSource> };
  items: ReadonlyArray<NavItem>;
  pathname: string;
  link?: ShellLink;
  actions?: React.ReactNode;
  navLabel?: string;
}

function PublicHeader({
  brand,
  items,
  pathname,
  link,
  actions,
  navLabel = "Primary",
}: PublicHeaderProps) {
  const [open, setOpen] = useState(false);
  const activeHref = findActiveHref(items, pathname);

  const navLinks = (onSelect?: () => void, vertical = false) =>
    items.map(({ href, label, icon: Icon }) => {
      const active = href === activeHref;
      return (
        <li key={href}>
          {linkElement(link, {
            href,
            onClick: onSelect,
            "aria-current": active ? "page" : undefined,
            className: cn(
              buttonVariants({ variant: active ? "secondary" : "ghost", size: "lg" }),
              vertical && "w-full justify-start",
            ),
            children: (
              <>
                <Icon aria-hidden="true" />
                {label}
              </>
            ),
          })}
        </li>
      );
    });

  return (
    <ShellHeader contained>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon-lg" className="md:hidden" aria-label="Open menu" />
          }
        >
          <MenuIcon aria-hidden="true" />
        </SheetTrigger>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <nav aria-label={`${navLabel} mobile`} className="px-4">
            <ul className="flex flex-col gap-1">{navLinks(() => setOpen(false), true)}</ul>
          </nav>
        </SheetContent>
      </Sheet>
      {linkElement(link, {
        href: brand.href,
        className:
          "focus-visible:ring-ring flex min-w-0 items-center gap-2 rounded-md outline-hidden focus-visible:ring-2",
        children: (
          <>
            {brand.logos.map((logo) => (
              <ThemedLogo key={logo.src} {...logo} eager className="h-9" />
            ))}
            <span className="flex min-w-0 flex-col leading-tight max-lg:sr-only">
              <span className="font-display truncate text-base font-semibold">{brand.name}</span>
              {brand.subtitle ? (
                <span className="text-muted-foreground truncate text-sm">{brand.subtitle}</span>
              ) : null}
            </span>
          </>
        ),
      })}
      <nav aria-label={navLabel} className="mx-auto hidden md:block">
        <ul className="flex items-center gap-1">{navLinks()}</ul>
      </nav>
      <div className="ml-auto flex items-center gap-1 md:ml-0">{actions}</div>
    </ShellHeader>
  );
}

export { PublicHeader };
export type { PublicHeaderProps };

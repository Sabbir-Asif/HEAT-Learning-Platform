"use client";

import type { LucideIcon } from "lucide-react";
import { Button } from "../components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/dropdown-menu";
import { linkElement } from "./link";
import { initials } from "./nav";
import type { ShellLink } from "./types";

interface UserMenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface UserMenuProps {
  name: string;
  email?: string;
  items: ReadonlyArray<UserMenuItem>;
  link?: ShellLink;
}

function UserMenu({ name, email, items, link }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button data-slot="user-menu" variant="ghost" size="lg" title={name} />}
      >
        <span
          aria-hidden="true"
          className="bg-accent text-accent-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
        >
          {initials(name)}
        </span>
        <span className="max-w-40 truncate max-md:sr-only">{name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex max-w-64 flex-col">
            <span className="text-foreground truncate text-sm font-medium" title={name}>
              {name}
            </span>
            {email ? (
              <span className="truncate" title={email}>
                {email}
              </span>
            ) : null}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {items.map(({ href, label, icon: Icon }) => (
          <DropdownMenuItem key={href} render={linkElement(link, { href })}>
            <Icon aria-hidden="true" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { UserMenu };
export type { UserMenuItem, UserMenuProps };

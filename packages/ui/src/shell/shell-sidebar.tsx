"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "../components/sidebar";
import { cn } from "../lib/utils";
import { linkElement } from "./link";
import { findActiveHref, type NavGroup } from "./nav";
import { ThemedLogo } from "./themed-logo";
import type { LogoSource, ShellLink } from "./types";

interface ShellSidebarProps {
  brand: { name: string; href: string; logo: LogoSource };
  groups: ReadonlyArray<NavGroup>;
  pathname: string;
  navLabel: string;
  link?: ShellLink;
  mode?: "fixed" | "drawer";
  showGroupLabels?: boolean;
}

function SidebarNav({
  groups,
  pathname,
  navLabel,
  link,
  showGroupLabels = true,
}: Pick<ShellSidebarProps, "groups" | "pathname" | "navLabel" | "link" | "showGroupLabels">) {
  const { setOpenMobile } = useSidebar();
  const activeHref = findActiveHref(
    groups.flatMap((group) => group.items),
    pathname,
  );
  return (
    <nav aria-label={navLabel} data-slot="sidebar-nav">
      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          {showGroupLabels ? <SidebarGroupLabel>{group.label}</SidebarGroupLabel> : null}
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = href === activeHref;
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      className="h-10"
                      isActive={active}
                      onClick={() => setOpenMobile(false)}
                      render={linkElement(link, {
                        href,
                        "aria-current": active ? "page" : undefined,
                      })}
                    >
                      <Icon aria-hidden="true" />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </nav>
  );
}

function ShellSidebar({
  brand,
  groups,
  pathname,
  navLabel,
  link,
  mode = "fixed",
  showGroupLabels,
}: ShellSidebarProps) {
  return (
    <Sidebar
      collapsible={mode === "drawer" ? "offcanvas" : "none"}
      className={cn(mode === "fixed" && "sticky top-0 h-svh shrink-0 max-md:hidden")}
    >
      <SidebarHeader className="p-4">
        {linkElement(link, {
          href: brand.href,
          className:
            "text-sidebar-foreground focus-visible:ring-sidebar-ring flex items-center gap-3 rounded-md outline-hidden focus-visible:ring-2",
          children: (
            <>
              <ThemedLogo {...brand.logo} tone="inverse" eager className="h-9" />
              <span className="font-display text-heading-3 truncate">{brand.name}</span>
            </>
          ),
        })}
      </SidebarHeader>
      <SidebarContent>
        <SidebarNav
          groups={groups}
          pathname={pathname}
          navLabel={navLabel}
          link={link}
          showGroupLabels={showGroupLabels}
        />
      </SidebarContent>
    </Sidebar>
  );
}

export { ShellSidebar, SidebarNav };
export type { ShellSidebarProps };

"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  SidebarProvider,
  SidebarTrigger,
} from "@heat/ui";
import {
  ShellHeader,
  ShellMain,
  ShellSidebar,
  SkipLink,
  ThemeSwitch,
  UserMenu,
} from "@heat/ui/shell";
import { UserCogIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useMemo, type ReactNode } from "react";
import { adminName } from "./brand";
import { buildBreadcrumbs } from "./breadcrumbs";
import { adminNavigation } from "./navigation";

export function AdminShell({
  children,
  email,
  isSuperAdmin = false,
}: {
  children: ReactNode;
  email?: string;
  isSuperAdmin?: boolean;
}) {
  const pathname = usePathname();
  const groups = useMemo(() => adminNavigation(isSuperAdmin), [isSuperAdmin]);
  const crumbs = buildBreadcrumbs(pathname, groups);
  return (
    <SidebarProvider>
      <SkipLink />
      <ShellSidebar
        mode="drawer"
        brand={{ name: adminName, href: "/" }}
        groups={groups}
        pathname={pathname}
        navLabel="Admin"
        link={Link}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <ShellHeader>
          <SidebarTrigger />
          <Breadcrumb>
            <BreadcrumbList>
              {crumbs.map((crumb, index) => (
                <Fragment key={`${crumb.label}-${index}`}>
                  <BreadcrumbItem>
                    {index === crumbs.length - 1 ? (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    ) : crumb.href ? (
                      <BreadcrumbLink render={<Link href={crumb.href} />}>
                        {crumb.label}
                      </BreadcrumbLink>
                    ) : (
                      <span>{crumb.label}</span>
                    )}
                  </BreadcrumbItem>
                  {index < crumbs.length - 1 ? <BreadcrumbSeparator /> : null}
                </Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-1">
            <ThemeSwitch />
            <UserMenu
              name="Administrator"
              email={email}
              items={[{ href: "/account", label: "Account", icon: UserCogIcon }]}
              link={Link}
            />
          </div>
        </ShellHeader>
        <ShellMain>{children}</ShellMain>
      </div>
    </SidebarProvider>
  );
}

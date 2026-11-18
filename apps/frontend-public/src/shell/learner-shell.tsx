"use client";

import { SidebarProvider } from "@heat/ui";
import {
  BottomBar,
  BrandLink,
  NotificationsLink,
  ShellHeader,
  ShellMain,
  ShellSidebar,
  SkipLink,
  ThemeSwitch,
  UserMenu,
} from "@heat/ui/shell";
import { UserIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useUnreadCount } from "../notifications/use-unread-count";
import { heatLogo } from "./brand";
import { learnerNavigation } from "./navigation";

const groups = [{ label: "Learn", items: learnerNavigation }];
const brandName = "Women Safety Awareness Program";

export function LearnerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const unreadCount = useUnreadCount();
  return (
    <SidebarProvider>
      <SkipLink />
      <ShellSidebar
        brand={{ name: brandName, href: "/dashboard", logo: heatLogo }}
        groups={groups}
        pathname={pathname}
        navLabel="Learner"
        link={Link}
        showGroupLabels={false}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <ShellHeader>
          <BrandLink
            name={brandName}
            href="/dashboard"
            logo={heatLogo}
            link={Link}
            className="md:hidden"
          />
          <div className="ml-auto flex items-center gap-1">
            <NotificationsLink href="/notifications" count={unreadCount} link={Link} />
            <ThemeSwitch />
            <UserMenu
              name="Student account"
              items={[{ href: "/profile", label: "Profile", icon: UserIcon }]}
              link={Link}
            />
          </div>
        </ShellHeader>
        <ShellMain>{children}</ShellMain>
        <BottomBar
          items={learnerNavigation}
          pathname={pathname}
          label="Learner mobile"
          link={Link}
        />
      </div>
    </SidebarProvider>
  );
}

"use client";

import { buttonVariants } from "@heat/ui";
import { PublicFooter, PublicHeader, ShellMain, SkipLink, ThemeSwitch } from "@heat/ui/shell";
import { LayoutDashboardIcon, LogInIcon, UserPlusIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useStudentSession } from "../auth/use-student-session";
import { heatLogo, partnerLogos, siteName, siteShortName } from "./brand";
import { footerColumns, legalLinks, publicNavigation } from "./navigation";

function HeaderActions() {
  const state = useStudentSession();
  if (state.kind === "signed-in") {
    return (
      <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
        <LayoutDashboardIcon aria-hidden="true" />
        <span className="max-md:sr-only">Dashboard</span>
      </Link>
    );
  }
  return (
    <>
      <Link href="/sign-in" className={buttonVariants({ variant: "outline", size: "lg" })}>
        <LogInIcon aria-hidden="true" />
        <span className="max-md:sr-only">Sign in</span>
      </Link>
      <Link href="/enroll" className={buttonVariants({ size: "lg" })}>
        <UserPlusIcon aria-hidden="true" />
        <span className="max-md:sr-only">Enroll</span>
      </Link>
    </>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-svh flex-col">
      <SkipLink />
      <PublicHeader
        brand={{ name: siteShortName, href: "/" }}
        items={publicNavigation}
        pathname={pathname}
        link={Link}
        actions={
          <>
            <ThemeSwitch />
            <HeaderActions />
          </>
        }
      />
      <ShellMain>{children}</ShellMain>
      <PublicFooter
        brand={{
          name: siteName,
          description:
            "A women safety awareness course for University of Dhaka students, funded under the HEAT project (PIN 13019).",
        }}
        columns={footerColumns}
        partners={[heatLogo, ...partnerLogos]}
        legal={legalLinks}
        copyright="Copyright 2026 University of Dhaka. All rights reserved."
        link={Link}
      />
    </div>
  );
}

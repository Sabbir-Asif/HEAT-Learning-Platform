"use client";

import { buttonVariants } from "@heat/ui";
import { PublicFooter, PublicHeader, ShellMain, SkipLink, ThemeSwitch } from "@heat/ui/shell";
import { LogInIcon, UserPlusIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { crestLogo, heatLogo, partnerLogos, siteName } from "./brand";
import { footerColumns, legalLinks, publicNavigation } from "./navigation";

export function PublicShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <SkipLink />
      <PublicHeader
        brand={{
          name: siteName,
          subtitle: "University of Dhaka",
          href: "/",
          logos: [heatLogo, crestLogo],
        }}
        items={publicNavigation}
        pathname={pathname}
        link={Link}
        actions={
          <>
            <ThemeSwitch />
            <Link href="/sign-in" className={buttonVariants({ variant: "outline", size: "lg" })}>
              <LogInIcon aria-hidden="true" />
              <span className="max-md:sr-only">Sign in</span>
            </Link>
            <Link href="/enroll" className={buttonVariants({ size: "lg" })}>
              <UserPlusIcon aria-hidden="true" />
              <span className="max-md:sr-only">Enroll</span>
            </Link>
          </>
        }
      />
      <ShellMain>{children}</ShellMain>
      <PublicFooter
        brand={{
          name: siteName,
          description:
            "A gender safety course for University of Dhaka students, part of the HEAT project (PIN 13019).",
          logos: [heatLogo, crestLogo],
        }}
        columns={footerColumns}
        partners={partnerLogos}
        legal={legalLinks}
        copyright="Copyright 2026 University of Dhaka. All rights reserved."
        link={Link}
      />
    </>
  );
}

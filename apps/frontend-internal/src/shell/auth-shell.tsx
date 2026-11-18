import { AuthLayout, ThemeSwitch } from "@heat/ui/shell";
import { ClockIcon, KeyRoundIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { adminName, crestLogo, heatLogo } from "./brand";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <AuthLayout
      brand={{ name: adminName, href: "/", logos: [heatLogo, crestLogo] }}
      panel={{
        headline: "The Women Safety Awareness Program administration console.",
        points: [
          { icon: KeyRoundIcon, label: "Passwords are checked against known breaches" },
          { icon: ClockIcon, label: "Sessions end after 30 minutes idle" },
        ],
      }}
      actions={<ThemeSwitch />}
      link={Link}
    >
      {children}
    </AuthLayout>
  );
}

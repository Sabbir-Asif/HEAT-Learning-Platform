import { AuthLayout, ThemeSwitch } from "@heat/ui/shell";
import { ClockIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { adminName, crestLogo, heatLogo } from "./brand";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <AuthLayout
      brand={{ name: adminName, href: "/", logos: [heatLogo, crestLogo] }}
      panel={{
        headline: "The HEAT training administration console.",
        points: [
          { icon: ShieldCheckIcon, label: "Two-step verification on every sign-in" },
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

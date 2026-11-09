import { AuthLayout } from "@heat/ui/shell";
import { ThemeSwitch } from "@heat/ui/shell";
import { ClockIcon, ShieldCheckIcon, AwardIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { crestLogo, heatLogo } from "./brand";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <AuthLayout
      brand={{ name: "Gender Safety Training", href: "/", logos: [heatLogo, crestLogo] }}
      panel={{
        headline: "A safer campus starts with people who know what to do.",
        points: [
          { icon: ClockIcon, label: "Short, self-paced lessons" },
          { icon: ShieldCheckIcon, label: "Your progress stays confidential" },
          { icon: AwardIcon, label: "A certificate when you finish" },
        ],
      }}
      actions={<ThemeSwitch />}
      link={Link}
    >
      {children}
    </AuthLayout>
  );
}

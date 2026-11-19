import { AuthLayout } from "@heat/ui/shell";
import { ThemeSwitch } from "@heat/ui/shell";
import { ClockIcon, ShieldCheckIcon, AwardIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <AuthLayout
      brand={{ name: "Women Safety Awareness Program", href: "/" }}
      panel={{
        image: (
          <Image src="/hero/campus-gathering.jpg" alt="" fill priority unoptimized sizes="100vw" />
        ),
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

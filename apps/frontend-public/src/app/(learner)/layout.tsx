import { Toaster } from "@heat/ui";
import type { ReactNode } from "react";
import { LearnerShell } from "@/shell/learner-shell";

export default function LearnerLayout({ children }: { children: ReactNode }) {
  return (
    <LearnerShell>
      {children}
      <Toaster />
    </LearnerShell>
  );
}

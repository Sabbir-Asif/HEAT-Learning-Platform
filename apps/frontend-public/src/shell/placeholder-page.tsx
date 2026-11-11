import type { ReactNode } from "react";
import { EmptyState, PageHeader } from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { ConstructionIcon } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  action?: ReactNode;
  children?: ReactNode;
}

export function PlaceholderPage({ title, action, children }: PlaceholderPageProps) {
  return (
    <ShellContent>
      <PageHeader title={title} action={action} />
      {children}
      <EmptyState
        icon={ConstructionIcon}
        title="This page is coming soon"
        description="The content for this page is being prepared."
      />
    </ShellContent>
  );
}

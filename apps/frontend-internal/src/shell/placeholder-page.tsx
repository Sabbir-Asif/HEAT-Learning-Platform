import { EmptyState, PageHeader } from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { ConstructionIcon } from "lucide-react";

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <ShellContent>
      <PageHeader title={title} />
      <EmptyState
        icon={ConstructionIcon}
        title="This page is coming soon"
        description="The content for this page is being prepared."
      />
    </ShellContent>
  );
}

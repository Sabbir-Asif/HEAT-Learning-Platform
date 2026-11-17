import { Button, EmptyState } from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { SearchXIcon } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <ShellContent>
      <EmptyState
        icon={SearchXIcon}
        title="Page not found"
        description="This page does not exist or is no longer available."
        action={
          <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
            Back to the home page
          </Button>
        }
      />
    </ShellContent>
  );
}

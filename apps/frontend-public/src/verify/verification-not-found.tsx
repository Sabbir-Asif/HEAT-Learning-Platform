import { Button, EmptyState } from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { SearchXIcon } from "lucide-react";
import Link from "next/link";

export function VerificationNotFound() {
  return (
    <ShellContent>
      <EmptyState
        icon={SearchXIcon}
        title="Certificate not found"
        description="No certificate matches this number. Check the number and try again."
        action={
          <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
            Go to the home page
          </Button>
        }
      />
    </ShellContent>
  );
}

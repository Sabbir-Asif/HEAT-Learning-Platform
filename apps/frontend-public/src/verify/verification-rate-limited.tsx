import { ErrorState } from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";

export function VerificationRateLimited() {
  return (
    <ShellContent>
      <ErrorState
        title="Too many checks"
        description="Certificate checks are paused for a moment. Try again in a minute."
      />
    </ShellContent>
  );
}

"use client";

import { ConfirmDialog, PageHeader } from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { useState } from "react";
import { ContactSettingsSection } from "./contact-settings-section";
import { landingOverviewLeaveMessage } from "./landing-overview-copy";
import { LandingOverviewSection } from "./landing-overview-view";
import { useUnsavedChangesGuard } from "./use-unsaved-changes-guard";

export function ContentPagesView() {
  const [overviewDirty, setOverviewDirty] = useState(false);
  const [contactDirty, setContactDirty] = useState(false);
  const guard = useUnsavedChangesGuard(overviewDirty || contactDirty);

  return (
    <ShellContent>
      <PageHeader title="Pages" />
      <LandingOverviewSection onDirtyChange={setOverviewDirty} />
      <ContactSettingsSection onDirtyChange={setContactDirty} />
      <ConfirmDialog
        open={guard.confirming}
        onOpenChange={(open) => (open ? undefined : guard.stay())}
        title="Leave this page?"
        itemName="Pages"
        description={landingOverviewLeaveMessage}
        confirmLabel="Leave page"
        destructive
        onConfirm={guard.leave}
      />
    </ShellContent>
  );
}

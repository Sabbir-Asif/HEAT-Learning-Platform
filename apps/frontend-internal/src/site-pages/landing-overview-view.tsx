"use client";

import { getAdminSiteSettingsGetQueryKey, useAdminSiteSettingsGet } from "@heat/api-client";
import { ConfirmDialog, ErrorState, FieldDescription, PageHeader, Skeleton } from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { landingOverviewLeaveMessage, landingOverviewSavedMessage } from "./landing-overview-copy";
import { LandingOverviewForm } from "./landing-overview-form";
import { useUnsavedChangesGuard } from "./use-unsaved-changes-guard";

export function LandingOverviewView() {
  const queryClient = useQueryClient();
  const overview = useAdminSiteSettingsGet();
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const guard = useUnsavedChangesGuard(dirty);

  return (
    <ShellContent>
      <PageHeader title="Landing page overview" />
      {notice === null ? null : <FieldDescription role="status">{notice}</FieldDescription>}
      {overview.isPending ? <Skeleton className="h-64 w-full" /> : null}
      {overview.isError ? (
        <ErrorState
          title="The overview could not be loaded"
          description="Check your connection and try again."
          onRetry={() => void overview.refetch()}
        />
      ) : null}
      {overview.data === undefined ? null : (
        <LandingOverviewForm
          key={overview.data.updatedAt ?? "new"}
          overview={overview.data}
          onDirtyChange={setDirty}
          onSaved={async () => {
            setNotice(landingOverviewSavedMessage);
            await queryClient.invalidateQueries({ queryKey: getAdminSiteSettingsGetQueryKey() });
          }}
        />
      )}
      <ConfirmDialog
        open={guard.confirming}
        onOpenChange={(open) => (open ? undefined : guard.stay())}
        title="Leave this page?"
        itemName="Overview"
        description={landingOverviewLeaveMessage}
        confirmLabel="Leave page"
        destructive
        onConfirm={guard.leave}
      />
    </ShellContent>
  );
}

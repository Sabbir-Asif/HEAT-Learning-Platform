"use client";

import { getAdminSiteSettingsGetQueryKey, useAdminSiteSettingsGet } from "@heat/api-client";
import { ErrorState, FieldDescription, SectionHeading, Skeleton } from "@heat/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { landingOverviewSavedMessage } from "./landing-overview-copy";
import { LandingOverviewForm } from "./landing-overview-form";

type LandingOverviewSectionProps = { onDirtyChange: (dirty: boolean) => void };

export function LandingOverviewSection({ onDirtyChange }: LandingOverviewSectionProps) {
  const queryClient = useQueryClient();
  const overview = useAdminSiteSettingsGet();
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <section aria-labelledby="landing-overview-heading" className="flex flex-col gap-4">
      <SectionHeading id="landing-overview-heading">Landing page overview</SectionHeading>
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
          onDirtyChange={onDirtyChange}
          onSaved={async () => {
            setNotice(landingOverviewSavedMessage);
            await queryClient.invalidateQueries({ queryKey: getAdminSiteSettingsGetQueryKey() });
          }}
        />
      )}
    </section>
  );
}

"use client";

import { getAdminContactSettingsGetQueryKey, useAdminContactSettingsGet } from "@heat/api-client";
import { ErrorState, FieldDescription, SectionHeading, Skeleton } from "@heat/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { contactSettingsSavedMessage } from "./contact-settings-copy";
import { ContactSettingsForm } from "./contact-settings-form";

type ContactSettingsSectionProps = { onDirtyChange: (dirty: boolean) => void };

export function ContactSettingsSection({ onDirtyChange }: ContactSettingsSectionProps) {
  const queryClient = useQueryClient();
  const settings = useAdminContactSettingsGet();
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <section aria-labelledby="contact-settings-heading" className="flex flex-col gap-4">
      <SectionHeading id="contact-settings-heading">Contact details</SectionHeading>
      {notice === null ? null : <FieldDescription role="status">{notice}</FieldDescription>}
      {settings.isPending ? <Skeleton className="h-64 w-full" /> : null}
      {settings.isError ? (
        <ErrorState
          title="The contact details could not be loaded"
          description="Check your connection and try again."
          onRetry={() => void settings.refetch()}
        />
      ) : null}
      {settings.data === undefined ? null : (
        <ContactSettingsForm
          key={settings.data.updatedAt ?? "new"}
          settings={settings.data}
          onDirtyChange={onDirtyChange}
          onSaved={async () => {
            setNotice(contactSettingsSavedMessage);
            await queryClient.invalidateQueries({ queryKey: getAdminContactSettingsGetQueryKey() });
          }}
        />
      )}
    </section>
  );
}

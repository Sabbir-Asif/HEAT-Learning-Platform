"use client";

import { getAdminQuizSettingsGetQueryKey, useAdminQuizSettingsGet } from "@heat/api-client";
import { ErrorState, FieldDescription, PageHeader, SectionHeading, Skeleton } from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { QuizSettingsForm } from "./quiz-settings-form";
import { quizSettingsSavedMessage } from "./settings-copy";

export function SettingsView() {
  const queryClient = useQueryClient();
  const settings = useAdminQuizSettingsGet();
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <ShellContent>
      <PageHeader title="Settings" />
      <section aria-labelledby="quiz-settings-heading" className="flex max-w-2xl flex-col gap-4">
        <SectionHeading id="quiz-settings-heading">Quizzes</SectionHeading>
        {notice === null ? null : <FieldDescription role="status">{notice}</FieldDescription>}
        {settings.isPending ? <Skeleton className="h-32 w-full" /> : null}
        {settings.isError ? (
          <ErrorState
            title="The quiz settings could not be loaded"
            description="Check your connection and try again."
            onRetry={() => void settings.refetch()}
          />
        ) : null}
        {settings.data === undefined ? null : (
          <QuizSettingsForm
            key={settings.data.updatedAt ?? "new"}
            settings={settings.data}
            onSaved={async () => {
              setNotice(quizSettingsSavedMessage);
              await queryClient.invalidateQueries({ queryKey: getAdminQuizSettingsGetQueryKey() });
            }}
          />
        )}
      </section>
    </ShellContent>
  );
}

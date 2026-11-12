"use client";

import {
  getResourcesGetQueryKey,
  getResourcesListQueryKey,
  isApiError,
  useResourcesGet,
} from "@heat/api-client";
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FieldDescription,
  PageHeader,
  Skeleton,
  StatusBadge,
} from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { useQueryClient } from "@tanstack/react-query";
import { SearchXIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useUnsavedChangesGuard } from "../site-pages/use-unsaved-changes-guard";
import { resourceLeaveMessage, resourceSavedMessage } from "./resources-copy";
import { ResourceForm } from "./resource-form";

export const newResourceId = "new";

function LeaveGuard({ dirty, children }: { dirty: boolean; children: React.ReactNode }) {
  const guard = useUnsavedChangesGuard(dirty);
  return (
    <>
      {children}
      <ConfirmDialog
        open={guard.confirming}
        onOpenChange={(open) => (open ? undefined : guard.stay())}
        title="Leave this page?"
        itemName="Resource"
        description={resourceLeaveMessage}
        confirmLabel="Leave page"
        destructive
        onConfirm={guard.leave}
      />
    </>
  );
}

export function ResourceEditorView({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const creating = id === newResourceId;
  const resource = useResourcesGet(id, { query: { enabled: !creating } });
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!creating && resource.isPending) {
    return (
      <ShellContent>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </ShellContent>
    );
  }

  if (!creating && resource.isError) {
    const missing = isApiError(resource.error) && resource.error.code === "NOT_FOUND";
    return (
      <ShellContent>
        {missing ? (
          <EmptyState
            icon={SearchXIcon}
            title="Resource not found"
            description="It may have been deleted."
          />
        ) : (
          <ErrorState
            title="The resource could not be loaded"
            onRetry={() => void resource.refetch()}
          />
        )}
      </ShellContent>
    );
  }

  const current = creating ? null : (resource.data ?? null);

  return (
    <LeaveGuard dirty={dirty}>
      <ShellContent>
        <PageHeader
          title={current === null ? "New resource" : current.title}
          action={
            current === null ? undefined : (
              <StatusBadge kind="resource" status={current.published ? "published" : "draft"} />
            )
          }
        />
        {notice === null ? null : <FieldDescription role="status">{notice}</FieldDescription>}
        <ResourceForm
          key={current?.updatedAt ?? "new"}
          resource={current}
          onDirtyChange={setDirty}
          onSaved={async (saved) => {
            setDirty(false);
            setNotice(resourceSavedMessage);
            await queryClient.invalidateQueries({
              queryKey: getResourcesListQueryKey().slice(0, 1),
            });
            await queryClient.invalidateQueries({ queryKey: getResourcesGetQueryKey(saved.id) });
            if (creating) router.replace(`/content/resources/${saved.id}`);
          }}
        />
      </ShellContent>
    </LeaveGuard>
  );
}

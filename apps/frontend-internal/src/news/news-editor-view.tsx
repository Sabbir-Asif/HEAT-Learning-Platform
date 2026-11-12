"use client";

import { getNewsGetQueryKey, getNewsListQueryKey, isApiError, useNewsGet } from "@heat/api-client";
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
import { newsLeaveMessage, newsSavedMessage } from "./news-copy";
import { NewsForm } from "./news-form";

export const newPostId = "new";

function LeaveGuard({ dirty, children }: { dirty: boolean; children: React.ReactNode }) {
  const guard = useUnsavedChangesGuard(dirty);
  return (
    <>
      {children}
      <ConfirmDialog
        open={guard.confirming}
        onOpenChange={(open) => (open ? undefined : guard.stay())}
        title="Leave this page?"
        itemName="Post"
        description={newsLeaveMessage}
        confirmLabel="Leave page"
        destructive
        onConfirm={guard.leave}
      />
    </>
  );
}

export function NewsEditorView({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const creating = id === newPostId;
  const post = useNewsGet(id, { query: { enabled: !creating } });
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!creating && post.isPending) {
    return (
      <ShellContent>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </ShellContent>
    );
  }

  if (!creating && post.isError) {
    const missing = isApiError(post.error) && post.error.code === "NOT_FOUND";
    return (
      <ShellContent>
        {missing ? (
          <EmptyState
            icon={SearchXIcon}
            title="Post not found"
            description="It may have been deleted."
          />
        ) : (
          <ErrorState title="The post could not be loaded" onRetry={() => void post.refetch()} />
        )}
      </ShellContent>
    );
  }

  const current = creating ? null : (post.data ?? null);

  return (
    <LeaveGuard dirty={dirty}>
      <ShellContent>
        <PageHeader
          title={current === null ? "New post" : current.title}
          action={
            current === null ? undefined : <StatusBadge kind="news" status={current.status} />
          }
        />
        {current === null ? null : (
          <FieldDescription>{`Public address: /news/${current.slug}`}</FieldDescription>
        )}
        {notice === null ? null : <FieldDescription role="status">{notice}</FieldDescription>}
        <NewsForm
          key={current?.updatedAt ?? "new"}
          post={current}
          onDirtyChange={setDirty}
          onSaved={async (saved) => {
            setDirty(false);
            setNotice(newsSavedMessage);
            await queryClient.invalidateQueries({ queryKey: getNewsListQueryKey().slice(0, 1) });
            await queryClient.invalidateQueries({ queryKey: getNewsGetQueryKey(saved.id) });
            if (creating) router.replace(`/content/news/${saved.id}`);
          }}
        />
      </ShellContent>
    </LeaveGuard>
  );
}

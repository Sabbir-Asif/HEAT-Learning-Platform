"use client";

import { useTagsGet, useTagsRemove } from "@heat/api-client";
import type { TagSummaryDto } from "@heat/api-client";
import { Button, ConfirmDialog } from "@heat/ui";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { tagDeleteDescription, tagDeleteFailedMessage } from "./tags-copy";

type TagDeleteDialogProps = {
  tag: TagSummaryDto;
  onDeleted: (message: string) => void | Promise<void>;
};

export function TagDeleteDialog({ tag, onDeleted }: TagDeleteDialogProps) {
  const [open, setOpen] = useState(false);
  const detail = useTagsGet(tag.id, { query: { enabled: open, staleTime: 0 } });
  const remove = useTagsRemove();

  const description = detail.isSuccess
    ? tagDeleteDescription(detail.data)
    : detail.isError
      ? "The usage of this tag could not be loaded. Deleting it removes it from every course and module that uses it."
      : "Checking where this tag is used.";

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="outline" size="sm">
          <Trash2Icon data-icon="inline-start" />
          Delete
        </Button>
      }
      title="Delete this tag?"
      itemName={tag.name}
      confirmationName={tag.name}
      description={description}
      confirmLabel="Delete tag"
      destructive
      errorMessage={tagDeleteFailedMessage(tag.name)}
      onConfirm={async () => {
        await remove.mutateAsync({ id: tag.id });
        await onDeleted(`${tag.name} was deleted.`);
      }}
    />
  );
}

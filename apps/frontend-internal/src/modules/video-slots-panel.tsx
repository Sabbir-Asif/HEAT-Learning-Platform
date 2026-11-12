"use client";

import {
  getVideoSlotsListQueryKey,
  isApiError,
  useVideoSlotsList,
  useVideoSlotsRemove,
  useVideoSlotsReorder,
  useVideoSlotsRetryTranscode,
} from "@heat/api-client";
import type { VideoSlotListResponseDto } from "@heat/api-client";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FieldDescription,
  FieldTitle,
  Skeleton,
  SortableList,
  StatusBadge,
} from "@heat/ui";
import { useQueryClient } from "@tanstack/react-query";
import { PencilIcon, PlusIcon, RotateCcwIcon, Trash2Icon, VideoIcon } from "lucide-react";
import { useState } from "react";
import { FormSheet } from "./form-sheet";
import {
  reorderFailedMessage,
  videoFailureMessage,
  videoRetryFailedMessage,
  videoSlotDeleteFailedMessage,
  videoSlotLockedMessage,
  videoSlotsPollInterval,
  videoTimeLabel,
} from "./modules-copy";
import { VideoSlotForm } from "./video-slot-form";
import { VideoSlotCaptions } from "./video-slot-captions";
import { VideoSlotUpload } from "./video-slot-upload";

type EditingSlot = { id: string; title: string; required: boolean } | "new" | null;

type VideoSlotsPanelProps = {
  courseId: string;
  moduleId: string;
  courseLocked: boolean;
};

export function VideoSlotsPanel({ courseId, moduleId, courseLocked }: VideoSlotsPanelProps) {
  const queryClient = useQueryClient();
  const slots = useVideoSlotsList(courseId, moduleId, {
    query: { refetchInterval: (query) => videoSlotsPollInterval(query.state.data?.items) },
  });
  const reorder = useVideoSlotsReorder();
  const remove = useVideoSlotsRemove();
  const retry = useVideoSlotsRetryTranscode();
  const [editing, setEditing] = useState<EditingSlot>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const listKey = getVideoSlotsListQueryKey(courseId, moduleId);

  if (slots.isPending) return <Skeleton className="h-40 w-full" />;
  if (slots.isError) {
    return (
      <ErrorState title="The videos could not be loaded" onRetry={() => void slots.refetch()} />
    );
  }

  const locked = courseLocked || slots.data.locked;
  const items = slots.data.items;

  const refresh = (saved: VideoSlotListResponseDto) => {
    queryClient.setQueryData(listKey, saved);
  };

  async function saveOrder(orderedIds: string[]) {
    setProblem(null);
    try {
      refresh(
        await reorder.mutateAsync({
          id: courseId,
          moduleId,
          data: { previousIds: items.map((slot) => slot.id), orderedIds },
        }),
      );
    } catch (error) {
      setProblem(reorderFailedMessage(isApiError(error) ? error.code : undefined));
      await queryClient.invalidateQueries({ queryKey: listKey });
    }
  }

  const addButton = (
    <Button disabled={locked} onClick={() => setEditing("new")}>
      <PlusIcon data-icon="inline-start" />
      Add video
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <FieldTitle>Videos</FieldTitle>
      {locked ? <FieldDescription>{videoSlotLockedMessage}</FieldDescription> : null}
      {problem !== null ? <FieldDescription role="alert">{problem}</FieldDescription> : null}
      {items.length === 0 ? (
        <EmptyState
          icon={VideoIcon}
          title="No video yet"
          description="Add a video slot, then upload the file into it."
          action={addButton}
        />
      ) : (
        <>
          <div>{addButton}</div>
          <SortableList
            aria-label="Videos in order"
            disabled={locked || reorder.isPending}
            onReorder={(orderedIds) => void saveOrder(orderedIds)}
            items={items.map((slot) => ({
              id: slot.id,
              label: slot.title,
              content: (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-auto">
                      {slot.order}. {slot.title}
                    </span>
                    <Badge variant="outline">{slot.required ? "Required" : "Optional"}</Badge>
                    {slot.status === "NOT_UPLOADED" ? (
                      <Badge variant="outline">No video uploaded</Badge>
                    ) : (
                      <StatusBadge kind="video" status={slot.status} />
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setEditing({ id: slot.id, title: slot.title, required: slot.required })
                      }
                    >
                      <PencilIcon data-icon="inline-start" />
                      Edit
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button type="button" variant="outline" size="sm" disabled={locked}>
                          <Trash2Icon data-icon="inline-start" />
                          Remove
                        </Button>
                      }
                      title="Remove this video slot?"
                      itemName={slot.title}
                      description="The slot is removed from the module. The uploaded file stays available to other course versions."
                      confirmLabel="Remove video"
                      destructive
                      errorMessage={videoSlotDeleteFailedMessage(slot.title)}
                      onConfirm={async () => {
                        refresh(
                          await remove.mutateAsync({ id: courseId, moduleId, videoId: slot.id }),
                        );
                      }}
                    />
                  </div>
                  {slot.status === "NOT_UPLOADED" ? null : (
                    <FieldDescription>
                      Uploaded {videoTimeLabel(slot.uploadedAt)}. Status changed{" "}
                      {videoTimeLabel(slot.statusChangedAt)}.
                    </FieldDescription>
                  )}
                  {slot.status === "FAILED" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <FieldDescription role="alert" className="mr-auto">
                        {videoFailureMessage(slot.failureReason)}
                      </FieldDescription>
                      <ConfirmDialog
                        trigger={
                          <Button type="button" variant="outline" size="sm">
                            <RotateCcwIcon data-icon="inline-start" />
                            Retry
                          </Button>
                        }
                        title="Retry processing this video?"
                        itemName={slot.title}
                        description="The uploaded file is processed again from the start."
                        confirmLabel="Retry processing"
                        errorMessage={videoRetryFailedMessage(undefined)}
                        onConfirm={async () => {
                          try {
                            refresh(
                              await retry.mutateAsync({
                                id: courseId,
                                moduleId,
                                videoId: slot.id,
                              }),
                            );
                          } catch (error) {
                            if (isApiError(error) && error.code === "VIDEO_NOT_FAILED") {
                              await queryClient.invalidateQueries({ queryKey: listKey });
                              setProblem(videoRetryFailedMessage(error.code));
                              return;
                            }
                            throw error;
                          }
                        }}
                      />
                    </div>
                  ) : null}
                  <VideoSlotUpload
                    courseId={courseId}
                    moduleId={moduleId}
                    videoId={slot.id}
                    title={slot.title}
                    hasVideo={slot.status !== "NOT_UPLOADED"}
                    disabled={locked}
                    rejectionReason={slot.rejectionReason}
                    onFinished={() => void queryClient.invalidateQueries({ queryKey: listKey })}
                  />
                  <VideoSlotCaptions
                    courseId={courseId}
                    moduleId={moduleId}
                    videoId={slot.id}
                    title={slot.title}
                    hasEnglishCaption={slot.captions.includes("en")}
                    ready={slot.status === "READY"}
                    onChanged={() => void queryClient.invalidateQueries({ queryKey: listKey })}
                  />
                </div>
              ),
            }))}
          />
        </>
      )}
      <FormSheet
        open={editing !== null}
        title={editing === "new" ? "Add a video" : "Edit the video"}
        description="The file is uploaded into the slot after it is saved."
        onClose={() => setEditing(null)}
      >
        {({ onDirtyChange, requestClose, close }) => (
          <VideoSlotForm
            courseId={courseId}
            moduleId={moduleId}
            slot={editing === "new" ? null : editing}
            locked={locked}
            onDirtyChange={onDirtyChange}
            onCancel={requestClose}
            onSaved={(saved) => {
              refresh(saved);
              close();
            }}
          />
        )}
      </FormSheet>
    </div>
  );
}

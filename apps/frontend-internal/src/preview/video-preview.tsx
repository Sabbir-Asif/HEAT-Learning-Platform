"use client";

import { isApiError, useAdminPlaybackPreview } from "@heat/api-client";
import type { VideoSlotListResponseDto } from "@heat/api-client";
import { maxPlaybackRate } from "@heat/contracts";
import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ErrorState,
  Skeleton,
  StatusBadge,
} from "@heat/ui";
import { VideoPlayer } from "@heat/ui/player";
import { PlayIcon } from "lucide-react";
import { useCallback } from "react";
import { videoStatusMessage } from "./preview-copy";

type PreviewSlot = VideoSlotListResponseDto["items"][number];

function PreviewFrame({ slot }: { slot: PreviewSlot }) {
  const start = useAdminPlaybackPreview();
  const { mutateAsync } = start;
  const refreshSession = useCallback(
    () => mutateAsync({ videoId: slot.id }),
    [mutateAsync, slot.id],
  );

  if (slot.status !== "READY") {
    return (
      <Card className="aspect-video items-center justify-center">
        <CardContent className="flex flex-col items-center gap-2">
          <StatusBadge kind="video" status={slot.status} />
          <CardDescription role="status">{videoStatusMessage(slot.status)}</CardDescription>
        </CardContent>
      </Card>
    );
  }

  if (start.data) {
    return (
      <VideoPlayer
        title={slot.title}
        manifestPath={start.data.manifestPath}
        initialExpiresAt={start.data.expiresAt}
        startPositionSeconds={0}
        captions={start.data.captions}
        maxPlaybackRate={maxPlaybackRate}
        refreshSession={refreshSession}
      />
    );
  }

  if (start.isPending) {
    return (
      <div aria-busy="true">
        <p role="status" className="sr-only">
          Loading video
        </p>
        <Skeleton className="aspect-video w-full" />
      </div>
    );
  }

  if (start.isError) {
    const notReady = isApiError(start.error) && start.error.code === "VIDEO_NOT_READY";
    return (
      <Card className="aspect-video items-center justify-center">
        {notReady ? (
          <CardDescription role="status">{videoStatusMessage("PROCESSING")}</CardDescription>
        ) : (
          <ErrorState
            title="This video could not be loaded"
            description="Check your connection and try again."
            onRetry={() => start.mutate({ videoId: slot.id })}
          />
        )}
      </Card>
    );
  }

  return (
    <Card className="aspect-video items-center justify-center">
      <CardContent>
        <Button onClick={() => start.mutate({ videoId: slot.id })}>
          <PlayIcon data-icon="inline-start" />
          Play video
        </Button>
      </CardContent>
    </Card>
  );
}

export default function VideoPreview({ slots }: { slots: readonly PreviewSlot[] }) {
  return (
    <section aria-label="Videos" className="flex flex-col gap-4">
      {slots.map((slot) => (
        <Card key={slot.id} size="sm">
          <CardHeader>
            <CardTitle>{slot.title}</CardTitle>
            {slot.required ? (
              <CardAction>
                <Badge variant="outline">Required</Badge>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent>
            <PreviewFrame slot={slot} />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

"use client";

import { useVideoSlotsList } from "@heat/api-client";
import type { VideoSlotListResponseDto } from "@heat/api-client";
import { Progress, ProgressLabel, ProgressValue } from "@heat/ui";
import { useCallback } from "react";
import { videoProcessingLabel } from "./modules-copy";

type VideoSlotProgressProps = {
  courseId: string;
  moduleId: string;
  videoId: string;
  status: "QUEUED" | "PROCESSING";
};

export function VideoSlotProgress({ courseId, moduleId, videoId, status }: VideoSlotProgressProps) {
  const select = useCallback(
    (data: VideoSlotListResponseDto) =>
      data.items.find((slot) => slot.id === videoId)?.progressPercent ?? null,
    [videoId],
  );
  const { data: percent = null } = useVideoSlotsList(courseId, moduleId, { query: { select } });
  return (
    <Progress value={status === "QUEUED" ? 0 : percent}>
      <ProgressLabel>{videoProcessingLabel(status, percent)}</ProgressLabel>
      {percent === null ? null : <ProgressValue />}
    </Progress>
  );
}

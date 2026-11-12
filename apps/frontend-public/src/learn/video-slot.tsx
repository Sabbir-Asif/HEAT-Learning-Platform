"use client";

import { maxPlaybackRate } from "@heat/contracts";
import { useStudentPlaybackRefresh, useStudentPlaybackStart } from "@heat/api-client";
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
} from "@heat/ui";
import { VideoPlayer } from "@heat/ui/player";
import { PlayIcon } from "lucide-react";
import { useCallback } from "react";
import { videoStatusText } from "./learning-view";
import { useProgressReporting } from "./use-progress-reporting";
import type { LearningModule } from "./learning-view";

export interface VideoSlotProps {
  courseId: string;
  videos: LearningModule["videos"];
}

type LessonVideo = LearningModule["videos"][number];

function VideoFrame({ courseId, video }: { courseId: string; video: LessonVideo }) {
  const start = useStudentPlaybackStart();
  const refresh = useStudentPlaybackRefresh();
  const { mutateAsync } = refresh;
  const onProgress = useProgressReporting({
    courseId,
    videoId: video.id,
    sessionId: start.data?.sessionId ?? null,
  });
  const refreshSession = useCallback(() => mutateAsync({ id: video.id }), [mutateAsync, video.id]);

  if (video.status === "UNAVAILABLE") {
    return (
      <Card className="aspect-video items-center justify-center">
        <CardContent>
          <CardDescription role="status">{videoStatusText(video)}</CardDescription>
        </CardContent>
      </Card>
    );
  }

  if (start.data) {
    return (
      <VideoPlayer
        title={video.title}
        manifestPath={start.data.manifestPath}
        initialExpiresAt={start.data.expiresAt}
        startPositionSeconds={start.data.resumePositionSeconds}
        captions={start.data.captions}
        maxPlaybackRate={maxPlaybackRate}
        refreshSession={refreshSession}
        onProgress={onProgress}
        autoPlay
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
    return (
      <Card className="aspect-video items-center justify-center">
        <ErrorState
          title="This video could not be loaded"
          description="Check your connection and try again."
          onRetry={() => start.mutate({ id: video.id })}
        />
      </Card>
    );
  }

  return (
    <Card className="aspect-video items-center justify-center">
      <CardContent className="flex flex-col items-center gap-2">
        <Button onClick={() => start.mutate({ id: video.id })}>
          <PlayIcon data-icon="inline-start" />
          Play video
        </Button>
        <CardDescription role="status">{videoStatusText(video)}</CardDescription>
      </CardContent>
    </Card>
  );
}

export default function VideoSlot({ courseId, videos }: VideoSlotProps) {
  return (
    <section aria-label="Videos" className="flex flex-col gap-4">
      {videos.map((video) => (
        <Card key={video.id} size="sm">
          <CardHeader>
            <CardTitle>{video.title}</CardTitle>
            {video.required ? (
              <CardAction>
                <Badge variant="outline">Required</Badge>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <VideoFrame courseId={courseId} video={video} />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

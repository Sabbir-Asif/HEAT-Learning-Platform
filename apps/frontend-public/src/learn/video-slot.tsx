"use client";

import { maxPlaybackRate } from "@heat/contracts";
import { useStudentPlaybackRefresh, useStudentPlaybackStart } from "@heat/api-client";
import { Badge, Button } from "@heat/ui";
import { VideoPlayer } from "@heat/ui/player";
import { ClockIcon, Loader2Icon, PlayIcon, RotateCcwIcon } from "lucide-react";
import { useCallback } from "react";
import type { ReactNode } from "react";
import { videoStatusText } from "./learning-view";
import { useProgressReporting } from "./use-progress-reporting";
import type { LearningModule } from "./learning-view";

export interface VideoSlotProps {
  courseId: string;
  videos: LearningModule["videos"];
}

type LessonVideo = LearningModule["videos"][number];

function PosterFrame({ children }: { children: ReactNode }) {
  return (
    <div className="bg-player text-player-foreground from-primary/40 via-player to-player relative grid aspect-video w-full place-items-center overflow-hidden rounded-xl bg-linear-to-br p-4 shadow-lg">
      <span
        aria-hidden="true"
        className="bg-sidebar-primary/20 absolute -top-16 -right-16 size-64 rounded-full blur-3xl"
      />
      <div className="relative flex flex-col items-center gap-3 text-center">{children}</div>
    </div>
  );
}

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
      <PosterFrame>
        <ClockIcon aria-hidden="true" className="size-8 opacity-80" />
        <p role="status" className="text-sm opacity-90">
          {videoStatusText(video)}
        </p>
      </PosterFrame>
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
        <PosterFrame>
          <Loader2Icon aria-hidden="true" className="size-10 animate-spin opacity-90" />
          <p role="status" className="text-sm opacity-90">
            Loading video
          </p>
        </PosterFrame>
      </div>
    );
  }

  if (start.isError) {
    return (
      <PosterFrame>
        <div role="alert" className="flex flex-col items-center gap-3">
          <p className="font-medium">This video could not be loaded</p>
          <p className="text-sm opacity-80">Check your connection and try again.</p>
          <Button variant="secondary" onClick={() => start.mutate({ id: video.id })}>
            <RotateCcwIcon data-icon="inline-start" />
            Try again
          </Button>
        </div>
      </PosterFrame>
    );
  }

  return (
    <PosterFrame>
      <button
        type="button"
        onClick={() => start.mutate({ id: video.id })}
        aria-label={`Play ${video.title}`}
        className="group focus-visible:ring-ring flex flex-col items-center gap-3 rounded-xl outline-none focus-visible:ring-3"
      >
        <span className="bg-primary text-primary-foreground grid size-20 place-items-center rounded-full shadow-lg transition-transform group-hover:scale-105">
          <PlayIcon aria-hidden="true" className="size-9 translate-x-0.5" />
        </span>
        <span className="text-xs font-semibold tracking-widest uppercase opacity-80">
          Play video
        </span>
        <span className="font-heading max-w-md text-lg font-semibold text-balance">
          {video.title}
        </span>
      </button>
      <p role="status" className="text-sm opacity-80">
        {videoStatusText(video)}
      </p>
    </PosterFrame>
  );
}

export default function VideoSlot({ courseId, videos }: VideoSlotProps) {
  return (
    <section aria-label="Videos" className="flex flex-col gap-6">
      {videos.map((video) => (
        <div key={video.id} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-heading text-player-foreground text-base font-semibold">
              {video.title}
            </h2>
            {video.required ? <Badge variant="secondary">Required</Badge> : null}
          </div>
          <VideoFrame courseId={courseId} video={video} />
        </div>
      ))}
    </section>
  );
}

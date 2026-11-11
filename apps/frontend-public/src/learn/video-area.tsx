"use client";

import { Skeleton } from "@heat/ui";
import dynamic from "next/dynamic";

export function VideoAreaLoading() {
  return (
    <div aria-busy="true" data-slot="video-area-loading">
      <p role="status" className="sr-only">
        Loading video
      </p>
      <Skeleton className="aspect-video w-full" />
    </div>
  );
}

export const VideoArea = dynamic(() => import("./video-slot"), {
  ssr: false,
  loading: VideoAreaLoading,
});

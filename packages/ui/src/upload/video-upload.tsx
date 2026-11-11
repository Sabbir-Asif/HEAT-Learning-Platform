"use client";

import * as React from "react";
import { PauseIcon, PlayIcon, RotateCcwIcon, UploadIcon, XIcon } from "lucide-react";
import { Button } from "../components/button";
import { Progress, ProgressLabel, ProgressValue } from "../components/progress";
import { cn } from "../lib/utils";
import { checkFile, formatBytes, videoRules } from "./limits";

type VideoUploadState =
  | { status: "idle" }
  | { status: "uploading"; fileName: string; progress: number }
  | { status: "paused"; fileName: string; progress: number }
  | { status: "failed"; fileName: string; message: string }
  | { status: "done"; fileName: string };

type VideoUploadProps = {
  label: string;
  state: VideoUploadState;
  maxBytes: number;
  hasVideo?: boolean;
  disabled?: boolean;
  onSelect: (file: File) => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRetry: () => void;
  className?: string;
};

function VideoUpload({
  label,
  state,
  maxBytes,
  hasVideo = false,
  disabled = false,
  onSelect,
  onPause,
  onResume,
  onCancel,
  onRetry,
  className,
}: VideoUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [rejection, setRejection] = React.useState<string | null>(null);
  const rules = React.useMemo(() => videoRules(maxBytes), [maxBytes]);

  function choose(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    const result = checkFile({ name: file.name, size: file.size, type: file.type }, rules, []);
    if (!result.ok) {
      setRejection(result.message);
      return;
    }
    setRejection(null);
    onSelect(file);
  }

  const busy = state.status === "uploading" || state.status === "paused";
  const chooseLabel = hasVideo ? "Replace video" : "Upload video";

  return (
    <div
      data-slot="video-upload"
      role="group"
      aria-label={label}
      className={cn("flex flex-col gap-2", className)}
    >
      <input
        ref={inputRef}
        type="file"
        accept={rules.extensions.map((extension) => `.${extension}`).join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled || busy}
        onChange={(event) => {
          choose(event.target.files);
          event.target.value = "";
        }}
      />

      {busy ? (
        <>
          <Progress value={state.progress}>
            <ProgressLabel>
              {state.status === "paused"
                ? `Paused ${state.fileName}`
                : `Uploading ${state.fileName}`}
            </ProgressLabel>
            <ProgressValue />
          </Progress>
          <div className="flex flex-wrap items-center gap-2">
            {state.status === "uploading" ? (
              <Button type="button" variant="outline" size="sm" onClick={onPause}>
                <PauseIcon data-icon="inline-start" />
                Pause
              </Button>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={onResume}>
                <PlayIcon data-icon="inline-start" />
                Resume
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              <XIcon data-icon="inline-start" />
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            <UploadIcon data-icon="inline-start" />
            {chooseLabel}
          </Button>
          <span className="text-muted-foreground text-xs">
            MP4, MOV, WebM or MKV, up to {formatBytes(maxBytes)}. The server checks the file again.
          </span>
        </div>
      )}

      {state.status === "failed" ? (
        <div role="alert" className="flex flex-wrap items-center gap-2">
          <span className="text-destructive text-sm">
            {state.fileName}: {state.message}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RotateCcwIcon data-icon="inline-start" />
            Retry
          </Button>
        </div>
      ) : null}
      {rejection !== null ? (
        <p role="alert" className="text-destructive text-sm">
          {rejection}
        </p>
      ) : null}
      {state.status === "done" ? (
        <p role="status" className="text-muted-foreground text-sm">
          {state.fileName} uploaded. The server is checking it.
        </p>
      ) : null}
    </div>
  );
}

export { VideoUpload };
export type { VideoUploadProps, VideoUploadState };

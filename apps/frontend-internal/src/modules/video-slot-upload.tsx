"use client";

import { fetchResponse } from "@heat/api-client";
import { videoUploadLimits } from "@heat/contracts";
import type { VideoRejectionReason } from "@heat/contracts";
import { FieldDescription } from "@heat/ui";
import { VideoUpload } from "@heat/ui/upload";
import type { VideoUploadState } from "@heat/ui/upload";
import { useEffect, useRef, useState } from "react";
import { videoRejectionMessage, videoUploadFailedMessage } from "./modules-copy";
import { createTusUpload } from "./tus-upload";
import type { TusUpload } from "./tus-upload";

type VideoSlotUploadProps = {
  courseId: string;
  moduleId: string;
  videoId: string;
  title: string;
  hasVideo: boolean;
  disabled: boolean;
  rejectionReason: VideoRejectionReason | null;
  onFinished: () => void;
};

const percentOf = (offset: number, total: number): number => Math.round((offset / total) * 100);

const codeOf = (error: unknown): string | undefined =>
  typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;

export function VideoSlotUpload({
  courseId,
  moduleId,
  videoId,
  title,
  hasVideo,
  disabled,
  rejectionReason,
  onFinished,
}: VideoSlotUploadProps) {
  const [state, setState] = useState<VideoUploadState>({ status: "idle" });
  const uploadRef = useRef<TusUpload | null>(null);
  const fileRef = useRef<File | null>(null);
  const reusableRef = useRef(false);
  const finishedRef = useRef(onFinished);

  useEffect(() => {
    finishedRef.current = onFinished;
  });

  useEffect(() => () => uploadRef.current?.cancel(), []);

  async function run(file: File, upload: TusUpload) {
    try {
      const outcome = await upload.start();
      setState(
        outcome === "completed" ? { status: "done", fileName: file.name } : { status: "idle" },
      );
    } catch (error) {
      const code = codeOf(error);
      reusableRef.current = code === "NETWORK_ERROR";
      setState({
        status: "failed",
        fileName: file.name,
        message: videoUploadFailedMessage(code),
      });
    } finally {
      finishedRef.current();
    }
  }

  function begin(file: File) {
    fileRef.current = file;
    reusableRef.current = false;
    const upload = createTusUpload(file, {
      url: `/admin/courses/${courseId}/modules/${moduleId}/videos/${videoId}/upload`,
      send: fetchResponse,
      onProgress: (offset, total) =>
        setState((current) =>
          current.status === "uploading"
            ? { status: "uploading", fileName: file.name, progress: percentOf(offset, total) }
            : current,
        ),
      onStateChange: (next) =>
        setState((current) =>
          current.status === "uploading" || current.status === "paused"
            ? { ...current, status: next }
            : current,
        ),
    });
    uploadRef.current = upload;
    setState({ status: "uploading", fileName: file.name, progress: 0 });
    void run(file, upload);
  }

  function retry() {
    const file = fileRef.current;
    const upload = uploadRef.current;
    if (file === null) return;
    if (upload === null || !reusableRef.current) {
      begin(file);
      return;
    }
    setState({ status: "uploading", fileName: file.name, progress: 0 });
    void run(file, upload);
  }

  return (
    <div className="flex flex-col gap-2">
      {rejectionReason !== null && state.status === "idle" ? (
        <FieldDescription role="alert">{videoRejectionMessage(rejectionReason)}</FieldDescription>
      ) : null}
      <VideoUpload
        label={`Upload for ${title}`}
        state={state}
        maxBytes={videoUploadLimits.maxBytes}
        hasVideo={hasVideo}
        disabled={disabled}
        onSelect={begin}
        onPause={() => uploadRef.current?.pause()}
        onResume={() => uploadRef.current?.resume()}
        onCancel={() => uploadRef.current?.cancel()}
        onRetry={retry}
      />
    </div>
  );
}

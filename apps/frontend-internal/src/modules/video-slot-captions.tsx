"use client";

import { fetchResponse, isApiError, useVideoCaptionsRemove } from "@heat/api-client";
import { FieldDescription, FieldTitle, Button } from "@heat/ui";
import { FileUpload } from "@heat/ui/upload";
import type { UploadItemState } from "@heat/ui/upload";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { captionRemoveFailedMessage, captionUploadFailedMessage } from "./modules-copy";

type VideoSlotCaptionsProps = {
  courseId: string;
  moduleId: string;
  videoId: string;
  title: string;
  hasEnglishCaption: boolean;
  ready: boolean;
  onChanged: () => void;
};

const language = "en";

const codeFromBody = async (response: Response): Promise<string | undefined> => {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "code" in body) {
      return typeof body.code === "string" ? body.code : undefined;
    }
  } catch {
    return undefined;
  }
  return undefined;
};

export function VideoSlotCaptions({
  courseId,
  moduleId,
  videoId,
  title,
  hasEnglishCaption,
  ready,
  onChanged,
}: VideoSlotCaptionsProps) {
  const remove = useVideoCaptionsRemove();
  const [statuses, setStatuses] = useState<Record<string, UploadItemState>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const url = `/admin/courses/${courseId}/modules/${moduleId}/videos/${videoId}/captions/${language}`;

  async function send(id: string, file: File) {
    setStatuses((current) => ({ ...current, [id]: { status: "uploading", progress: 0 } }));
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetchResponse(url, { method: "PUT", body });
      if (!response.ok) {
        const code = await codeFromBody(response);
        setStatuses((current) => ({
          ...current,
          [id]: { status: "failed", message: captionUploadFailedMessage(code) },
        }));
        return;
      }
      setStatuses((current) => ({ ...current, [id]: { status: "done" } }));
      onChanged();
    } catch (error) {
      const code = isApiError(error) ? error.code : undefined;
      setStatuses((current) => ({
        ...current,
        [id]: { status: "failed", message: captionUploadFailedMessage(code) },
      }));
    }
  }

  async function removeCaption() {
    setProblem(null);
    try {
      await remove.mutateAsync({ id: courseId, moduleId, videoId, language });
      onChanged();
    } catch {
      setProblem(captionRemoveFailedMessage);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <FieldTitle className="mr-auto">English captions</FieldTitle>
        {hasEnglishCaption ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={remove.isPending}
            onClick={() => void removeCaption()}
          >
            <Trash2Icon data-icon="inline-start" />
            Remove captions
          </Button>
        ) : null}
      </div>
      <FieldDescription>
        {hasEnglishCaption
          ? "Uploading a new file replaces the current English captions."
          : "Optional. Upload a WebVTT file of up to 1 MB. Learners see a captions menu only when a file exists."}
      </FieldDescription>
      {problem !== null ? <FieldDescription role="alert">{problem}</FieldDescription> : null}
      {ready ? (
        <FileUpload
          label={`English captions for ${title}`}
          preset="captions"
          statuses={statuses}
          onFilesAccepted={(accepted) => {
            for (const item of accepted) {
              setFiles((current) => ({ ...current, [item.id]: item.file }));
              void send(item.id, item.file);
            }
          }}
          onCancel={() => undefined}
          onRetry={(id) => {
            const file = files[id];
            if (file !== undefined) void send(id, file);
          }}
        />
      ) : (
        <FieldDescription>Captions can be added once the video is ready.</FieldDescription>
      )}
    </div>
  );
}

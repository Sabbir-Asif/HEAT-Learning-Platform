"use client";

import * as React from "react";
import Uppy from "@uppy/core";
import { FileIcon, RotateCcwIcon, UploadIcon, XIcon } from "lucide-react";
import { Button } from "../components/button";
import { Progress, ProgressLabel, ProgressValue } from "../components/progress";
import { cn } from "../lib/utils";
import {
  checkFile,
  documentRules,
  formatBytes,
  imageRules,
  type CandidateFile,
  type UploadRules,
} from "./limits";

type UploadStatus = "queued" | "uploading" | "failed" | "done";

type UploadItemState = {
  status: UploadStatus;
  progress?: number;
  message?: string;
};

type AcceptedFile = { id: string; file: File };

type FileUploadProps = {
  label: string;
  preset: "images" | "documents";
  statuses?: Record<string, UploadItemState>;
  onFilesAccepted: (files: AcceptedFile[]) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove?: (id: string) => void;
  disabled?: boolean;
  className?: string;
};

type SelectedFile = { id: string; name: string; size: number };

const presets: Record<FileUploadProps["preset"], UploadRules> = {
  images: imageRules,
  documents: documentRules,
};

const statusText: Record<UploadStatus, string> = {
  queued: "Waiting",
  uploading: "Uploading",
  failed: "Failed",
  done: "Uploaded",
};

function describeFile(file: { name: string; size?: number | null; type: string }): CandidateFile {
  return { name: file.name, size: file.size ?? 0, type: file.type };
}

function FileUpload({
  label,
  preset,
  statuses = {},
  onFilesAccepted,
  onCancel,
  onRetry,
  onRemove,
  disabled = false,
  className,
}: FileUploadProps) {
  const rules = presets[preset];
  const rulesRef = React.useRef(rules);
  const acceptedRef = React.useRef(onFilesAccepted);
  const uppyRef = React.useRef<Uppy | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [files, setFiles] = React.useState<SelectedFile[]>([]);
  const [rejections, setRejections] = React.useState<string[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const listId = React.useId();

  React.useEffect(() => {
    rulesRef.current = rules;
    acceptedRef.current = onFilesAccepted;
  });

  React.useEffect(() => {
    const uppy = new Uppy({
      autoProceed: false,
      onBeforeFileAdded: (current, existing) => {
        const result = checkFile(
          describeFile(current),
          rulesRef.current,
          Object.values(existing).map(describeFile),
        );
        if (result.ok) return true;
        setRejections((previous) => [...previous, result.message]);
        return false;
      },
    });
    uppyRef.current = uppy;

    uppy.on("file-added", (file) => {
      setFiles((previous) => [...previous, { id: file.id, name: file.name, size: file.size ?? 0 }]);
      if (file.data instanceof File) acceptedRef.current([{ id: file.id, file: file.data }]);
    });
    uppy.on("file-removed", (file) => {
      setFiles((previous) => previous.filter((item) => item.id !== file.id));
    });

    return () => {
      uppy.destroy();
      uppyRef.current = null;
    };
  }, []);

  function addAll(list: FileList | null) {
    const uppy = uppyRef.current;
    if (!uppy || !list) return;
    setRejections([]);
    for (const file of Array.from(list)) {
      try {
        uppy.addFile(file);
      } catch {
        continue;
      }
    }
  }

  function remove(id: string) {
    uppyRef.current?.removeFile(id);
    onRemove?.(id);
  }

  const uploading = files.filter((file) => statuses[file.id]?.status === "uploading").length;
  const failed = files.filter((file) => statuses[file.id]?.status === "failed").length;
  const summary =
    files.length === 0
      ? ""
      : `${files.length} ${files.length === 1 ? "file" : "files"}, ${uploading} uploading, ${failed} failed`;

  return (
    <div
      data-slot="file-upload"
      role="group"
      aria-label={label}
      className={cn("flex flex-col gap-3", className)}
    >
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) addAll(event.dataTransfer.files);
        }}
        data-dragging={dragging}
        className="data-[dragging=true]:border-ring flex flex-col items-start gap-2 rounded-lg border border-dashed p-4"
      >
        <input
          ref={inputRef}
          type="file"
          multiple={rules.maxFiles > 1}
          accept={rules.extensions.map((extension) => `.${extension}`).join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          disabled={disabled}
          onChange={(event) => {
            addAll(event.target.files);
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <UploadIcon data-icon="inline-start" />
          Choose files
        </Button>
        <p className="text-muted-foreground text-sm">
          Or drop files here.{" "}
          {rules.extensions.map((extension) => extension.toUpperCase()).join(", ")}, up to{" "}
          {formatBytes(rules.maxBytes)} each, at most {rules.maxFiles} files. The server checks
          every file again.
        </p>
      </div>

      {rejections.length > 0 ? (
        <div role="alert" className="text-destructive text-sm">
          <ul className="flex flex-col gap-1">
            {[...new Set(rejections)].map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p role="status" className="sr-only">
        {summary}
      </p>

      {files.length > 0 ? (
        <ul id={listId} aria-label="Selected files" className="flex flex-col gap-2">
          {files.map((file) => {
            const state = statuses[file.id];
            return (
              <li key={file.id} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <FileIcon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm" title={file.name}>
                    {file.name}
                  </span>
                  <span className="text-muted-foreground text-xs whitespace-nowrap">
                    {formatBytes(file.size)}
                  </span>
                </div>
                {state ? (
                  <p className="text-muted-foreground text-xs">{statusText[state.status]}</p>
                ) : null}
                {state?.status === "uploading" ? (
                  <Progress value={state.progress ?? 0}>
                    <ProgressLabel className="sr-only">{`Uploading ${file.name}`}</ProgressLabel>
                    <ProgressValue />
                  </Progress>
                ) : null}
                {state?.status === "failed" ? (
                  <p role="alert" className="text-destructive text-sm">
                    {state.message ?? "This file could not be uploaded."}
                  </p>
                ) : null}
                <div className="flex items-center justify-end gap-1">
                  {state?.status === "failed" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onRetry(file.id)}
                    >
                      <RotateCcwIcon data-icon="inline-start" />
                      Retry
                    </Button>
                  ) : null}
                  {state?.status === "uploading" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onCancel(file.id)}
                    >
                      <XIcon data-icon="inline-start" />
                      Cancel
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => remove(file.id)}
                    >
                      <XIcon data-icon="inline-start" />
                      Remove
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export { FileUpload };
export type { AcceptedFile, FileUploadProps, UploadItemState, UploadStatus };

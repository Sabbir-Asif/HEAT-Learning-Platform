"use client";

import { fetchResponse } from "@heat/api-client";
import { mediaAssetResponseSchema, mediaImageTypes, mediaLimits } from "@heat/contracts";
import { Button, FieldDescription, FieldTitle } from "@heat/ui";
import { ImagePlusIcon, Trash2Icon } from "lucide-react";
import { useRef, useState } from "react";
import { CourseThumbnail } from "./course-thumbnail";

export type ThumbnailValue = { assetId: string; url: string; alt: string };

type ThumbnailFieldProps = {
  title: string;
  value: ThumbnailValue | null;
  onChange: (value: ThumbnailValue | null) => void;
  disabled?: boolean;
};

const megabytes = mediaLimits.imageBytes / (1024 * 1024);

export function ThumbnailField({ title, value, onChange, disabled = false }: ThumbnailFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function upload(file: File) {
    setProblem(null);
    if (!(mediaImageTypes as readonly string[]).includes(file.type)) {
      setProblem("Choose a JPEG, PNG, WebP or AVIF image.");
      return;
    }
    if (file.size > mediaLimits.imageBytes) {
      setProblem(`The image is larger than ${megabytes} MB. Choose a smaller one.`);
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("kind", "image");
      body.append("visibility", "public");
      body.append("crop", "none");
      body.append("altText", title.trim() === "" ? "Course thumbnail" : title.trim());
      const response = await fetchResponse("/admin/media", { method: "POST", body });
      const parsed = response.ok
        ? mediaAssetResponseSchema.safeParse(await response.json())
        : undefined;
      if (parsed === undefined || !parsed.success) {
        setProblem("The image could not be uploaded. Try again.");
        return;
      }
      onChange({
        assetId: parsed.data.id,
        url: parsed.data.url,
        alt: parsed.data.altText ?? "",
      });
    } catch {
      setProblem("The image could not be uploaded. Try again.");
    } finally {
      setBusy(false);
      if (input.current !== null) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <FieldTitle>Thumbnail</FieldTitle>
      <div className="ring-divider w-full max-w-md overflow-hidden rounded-xl ring-1">
        <CourseThumbnail title={title} thumbnail={value} sizes="480px" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          type="file"
          accept={mediaImageTypes.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose a thumbnail image"
          disabled={disabled || busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file !== undefined) void upload(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || busy}
          onClick={() => input.current?.click()}
        >
          <ImagePlusIcon data-icon="inline-start" />
          {busy ? "Uploading" : value === null ? "Upload image" : "Replace image"}
        </Button>
        {value === null ? null : (
          <Button
            type="button"
            variant="ghostDestructive"
            disabled={disabled || busy}
            onClick={() => onChange(null)}
          >
            <Trash2Icon data-icon="inline-start" />
            Remove
          </Button>
        )}
      </div>
      <FieldDescription>
        Shown on the course card. JPEG, PNG, WebP or AVIF up to {megabytes} MB, wide images work
        best.
      </FieldDescription>
      {problem !== null ? <FieldDescription role="alert">{problem}</FieldDescription> : null}
    </div>
  );
}

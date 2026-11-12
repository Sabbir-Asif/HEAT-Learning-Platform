"use client";

import {
  isApiError,
  useLessonSectionsReadBody,
  useLessonSectionsUpdateBody,
} from "@heat/api-client";
import { parseRichText, richTextEmptyDoc, richTextSchemaVersion } from "@heat/contracts";
import { Button, ErrorState, FieldDescription, Skeleton } from "@heat/ui";
import type { RichTextDocument } from "@heat/ui/content";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { sectionBodyFailedMessage } from "./modules-copy";

const RichTextEditor = dynamic(
  () => import("@heat/ui/editor").then((module) => module.RichTextEditor),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> },
);

type SectionBodyFormProps = {
  courseId: string;
  moduleId: string;
  sectionId: string;
  onSaved: () => void | Promise<void>;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
};

export function SectionBodyForm({
  courseId,
  moduleId,
  sectionId,
  onSaved,
  onCancel,
  onDirtyChange,
}: SectionBodyFormProps) {
  const body = useLessonSectionsReadBody(courseId, moduleId, sectionId);
  const save = useLessonSectionsUpdateBody();
  const [draft, setDraft] = useState<RichTextDocument | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    onDirtyChange?.(draft !== null);
  }, [draft, onDirtyChange]);

  if (body.isPending) return <Skeleton className="h-48 w-full" />;
  if (body.isError || body.data === undefined) {
    return (
      <ErrorState
        title="The section text could not be loaded"
        description="Check your connection and try again."
        onRetry={() => void body.refetch()}
      />
    );
  }
  const parsed = parseRichText(body.data.body);
  const stored: RichTextDocument = parsed.ok ? parsed.doc : richTextEmptyDoc;

  async function submit() {
    if (draft === null) return;
    setProblem(null);
    try {
      await save.mutateAsync({
        id: courseId,
        moduleId,
        sectionId,
        data: { schemaVersion: richTextSchemaVersion, body: draft },
      });
      await onSaved();
    } catch (error) {
      setProblem(sectionBodyFailedMessage(isApiError(error) ? error.code : undefined));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {problem === null ? null : <FieldDescription role="alert">{problem}</FieldDescription>}
      <RichTextEditor
        label="Section text"
        value={stored}
        images={body.data.images}
        onChange={setDraft}
        disabled={save.isPending}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          disabled={draft === null || save.isPending}
          onClick={() => void submit()}
        >
          {save.isPending ? "Saving" : "Save"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

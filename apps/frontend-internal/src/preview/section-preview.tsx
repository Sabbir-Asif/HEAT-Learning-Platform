"use client";

import { useLessonSectionsReadBody } from "@heat/api-client";
import { parseRichText } from "@heat/contracts";
import { ErrorState, Skeleton } from "@heat/ui";
import { RichTextRenderer } from "@heat/ui/content";

type SectionPreviewProps = { courseId: string; moduleId: string; sectionId: string; title: string };

export function SectionPreview({ courseId, moduleId, sectionId, title }: SectionPreviewProps) {
  const body = useLessonSectionsReadBody(courseId, moduleId, sectionId);
  if (body.isPending) return <Skeleton className="h-24 w-full" />;
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
  if (!parsed.ok) return null;
  return (
    <section aria-label={title === "" ? "Lesson" : title}>
      <RichTextRenderer title={title} document={parsed.doc} images={body.data.images} />
    </section>
  );
}

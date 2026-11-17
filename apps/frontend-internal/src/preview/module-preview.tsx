"use client";

import { useVideoSlotsList } from "@heat/api-client";
import type { ModuleSummaryDto } from "@heat/api-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  FieldTitle,
  LessonText,
  Skeleton,
} from "@heat/ui";
import type { LessonBlock } from "@heat/ui";
import { FileTextIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { QuizPreviewPanel } from "./quiz-preview-panel";
import { SectionPreview } from "./section-preview";

const VideoPreview = dynamic(() => import("./video-preview"), {
  ssr: false,
  loading: () => <Skeleton className="aspect-video w-full" />,
});

const objectiveBlock = (objectives: readonly string[]): LessonBlock => ({
  kind: "list",
  ordered: false,
  items: objectives.map((text) => [{ kind: "text", text, bold: false, italic: false, href: null }]),
});

function Videos({ courseId, moduleId }: { courseId: string; moduleId: string }) {
  const slots = useVideoSlotsList(courseId, moduleId);
  if (slots.isPending) return <Skeleton className="aspect-video w-full" />;
  if (slots.isError) {
    return (
      <ErrorState title="The videos could not be loaded" onRetry={() => void slots.refetch()} />
    );
  }
  if (slots.data.items.length === 0) return null;
  return <VideoPreview slots={slots.data.items} />;
}

export function ModulePreview({
  courseId,
  module,
}: {
  courseId: string;
  module: ModuleSummaryDto;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card size="sm">
        <CardHeader>
          <CardTitle>
            <h2>Learning objectives</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {module.objectives.length === 0 ? (
            <CardDescription>No objectives are listed for this module.</CardDescription>
          ) : (
            <LessonText blocks={[objectiveBlock(module.objectives)]} />
          )}
        </CardContent>
      </Card>
      <Videos courseId={courseId} moduleId={module.id} />
      {module.sections.length === 0 ? (
        <EmptyState
          icon={FileTextIcon}
          title="No lesson text yet"
          description="Add sections on the Content tab of the module."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {module.sections.map((section) => (
            <SectionPreview
              key={section.id}
              courseId={courseId}
              moduleId={module.id}
              sectionId={section.id}
              title={section.title}
            />
          ))}
        </div>
      )}
      <div className="flex flex-col gap-3">
        <FieldTitle>Quiz</FieldTitle>
        <QuizPreviewPanel courseId={courseId} moduleId={module.id} />
      </div>
    </div>
  );
}

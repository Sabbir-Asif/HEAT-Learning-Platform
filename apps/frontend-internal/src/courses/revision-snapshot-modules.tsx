"use client";

import type { RevisionSnapshotResponseDto } from "@heat/api-client";
import { parseRichText } from "@heat/contracts";
import {
  Badge,
  BulletList,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  FieldDescription,
  FieldTitle,
  QuizPreview,
  StatusBadge,
} from "@heat/ui";
import { RichTextRenderer } from "@heat/ui/content";
import { LayersIcon } from "lucide-react";

type SnapshotModule = RevisionSnapshotResponseDto["modules"][number];
type SnapshotSection = SnapshotModule["sections"][number];

function Section({ section }: { section: SnapshotSection }) {
  const parsed = parseRichText(section.body);
  if (!parsed.ok) return null;
  return (
    <section aria-label={section.title === "" ? "Lesson" : section.title}>
      <RichTextRenderer title={section.title} document={parsed.doc} images={section.images} />
    </section>
  );
}

function ModuleCard({ module }: { module: SnapshotModule }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>
            {module.order}. {module.title}
          </h2>
        </CardTitle>
        <CardDescription>
          {module.sections.length} {module.sections.length === 1 ? "section" : "sections"},{" "}
          {module.videos.length} {module.videos.length === 1 ? "video" : "videos"},{" "}
          {module.quiz === null ? "no quiz" : `${module.quiz.questions.length} quiz questions`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {module.objectives.length === 0 ? null : (
          <div className="flex flex-col gap-2">
            <FieldTitle>Learning objectives</FieldTitle>
            <BulletList>
              {module.objectives.map((objective) => (
                <li key={objective}>{objective}</li>
              ))}
            </BulletList>
          </div>
        )}
        {module.videos.length === 0 ? null : (
          <div className="flex flex-col gap-2">
            <FieldTitle>Videos</FieldTitle>
            <ul className="flex flex-col gap-2">
              {module.videos.map((video) => (
                <li key={video.id} className="flex flex-wrap items-center gap-2">
                  <span>
                    {video.order}. {video.title}
                  </span>
                  {video.required ? <Badge variant="outline">Required</Badge> : null}
                  <StatusBadge kind="video" status={video.status} />
                </li>
              ))}
            </ul>
          </div>
        )}
        {module.sections.length === 0 ? null : (
          <div className="flex flex-col gap-6">
            {module.sections.map((section) => (
              <Section key={section.id} section={section} />
            ))}
          </div>
        )}
        {module.quiz === null || module.quiz.questions.length === 0 ? null : (
          <div className="flex flex-col gap-3">
            <FieldTitle>Quiz</FieldTitle>
            <FieldDescription>
              Pass mark {module.quiz.passMarkPercent}%.{" "}
              {module.quiz.attemptLimit === null
                ? "Unlimited attempts."
                : `${module.quiz.attemptLimit} attempts allowed.`}
            </FieldDescription>
            <QuizPreview questions={module.quiz.questions} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RevisionSnapshotModules({ modules }: { modules: readonly SnapshotModule[] }) {
  if (modules.length === 0) {
    return (
      <EmptyState
        icon={LayersIcon}
        title="No modules in this revision"
        description="This revision has no content."
      />
    );
  }
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {modules.map((module) => (
        <ModuleCard key={module.id} module={module} />
      ))}
    </div>
  );
}

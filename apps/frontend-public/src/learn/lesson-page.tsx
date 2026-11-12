import type { LessonContentResponse } from "@heat/contracts";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  LessonText,
  PageHeader,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@heat/ui";
import type { LessonBlock } from "@heat/ui";
import { RichTextRenderer } from "@heat/ui/content";
import { ShellContent } from "@heat/ui/shell";
import { FileTextIcon } from "lucide-react";
import Link from "next/link";
import { courseHref } from "./learning-view";
import type { LearningModule } from "./learning-view";
import { ModuleList } from "./module-list";
import { QuizAction } from "./quiz-action";
import { richSectionOf, sanitizeLessonBody } from "./lesson-text";
import { VideoArea } from "./video-area";

export type LessonContentState =
  | { status: "loading" }
  | { status: "error"; onRetry: () => void }
  | { status: "ready"; content: LessonContentResponse };

export interface LessonPageProps {
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  module: LearningModule;
  modules: readonly LearningModule[];
  lesson: LessonContentState;
}

const objectiveList = (objectives: readonly string[]): LessonBlock => ({
  kind: "list",
  ordered: false,
  items: objectives.map((text) => [{ kind: "text", text, bold: false, italic: false, href: null }]),
});

function Objectives({ objectives }: { objectives: readonly string[] }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <h2>Learning objectives</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {objectives.length === 0 ? (
          <CardDescription>No objectives are listed for this module.</CardDescription>
        ) : (
          <LessonText blocks={[objectiveList(objectives)]} />
        )}
      </CardContent>
    </Card>
  );
}

function Sections({ lesson }: { lesson: LessonContentState }) {
  if (lesson.status === "loading") {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <p role="status" className="sr-only">
          Loading lesson
        </p>
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
  if (lesson.status === "error") {
    return (
      <ErrorState
        title="The lesson could not be loaded"
        description="Check your connection and try again."
        onRetry={lesson.onRetry}
      />
    );
  }
  const { sections } = lesson.content;
  if (sections.length === 0) {
    return (
      <EmptyState
        icon={FileTextIcon}
        title="No lesson text yet"
        description="The text for this module is being prepared."
      />
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => {
        const rich = richSectionOf(section);
        return (
          <section key={section.id} aria-label={section.title === "" ? "Lesson" : section.title}>
            {rich === null ? (
              <LessonText title={section.title} blocks={sanitizeLessonBody(section.body)} />
            ) : (
              <RichTextRenderer
                title={section.title}
                document={rich.document}
                images={rich.images}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}

export function LessonPage({
  courseId,
  courseSlug,
  courseTitle,
  module,
  modules,
  lesson,
}: LessonPageProps) {
  const text = (
    <>
      <Sections lesson={lesson} />
      <QuizAction courseSlug={courseSlug} module={module} />
    </>
  );
  const modulesPanel = (
    <ModuleList courseSlug={courseSlug} modules={modules} currentModuleId={module.id} />
  );
  return (
    <ShellContent>
      <PageHeader
        title={module.title}
        breadcrumbs={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href={courseHref(courseSlug)} />}>
                  {courseTitle}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{module.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          {module.videos.length === 0 ? null : (
            <VideoArea courseId={courseId} videos={module.videos} />
          )}
          <div className="flex flex-col gap-6 max-lg:hidden" data-layout="laptop-text">
            {text}
          </div>
          <Tabs defaultValue="lesson" className="lg:hidden" data-layout="phone-tabs">
            <TabsList>
              <TabsTrigger value="lesson">Lesson</TabsTrigger>
              <TabsTrigger value="objectives">Objectives</TabsTrigger>
              <TabsTrigger value="modules">Modules</TabsTrigger>
            </TabsList>
            <TabsContent value="lesson" className="flex flex-col gap-6">
              {text}
            </TabsContent>
            <TabsContent value="objectives">
              <Objectives objectives={module.objectives} />
            </TabsContent>
            <TabsContent value="modules">{modulesPanel}</TabsContent>
          </Tabs>
        </div>
        <aside aria-label="Module navigation" className="flex flex-col gap-6 max-lg:hidden">
          <Objectives objectives={module.objectives} />
          {modulesPanel}
        </aside>
      </div>
    </ShellContent>
  );
}

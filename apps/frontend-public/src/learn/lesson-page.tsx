import type { LessonContentResponse } from "@heat/contracts";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  EmptyState,
  ErrorState,
  LessonText,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@heat/ui";
import { RichTextRenderer } from "@heat/ui/content";
import { ShellContent } from "@heat/ui/shell";
import {
  BookOpenTextIcon,
  CheckIcon,
  FileTextIcon,
  ListChecksIcon,
  NotebookPenIcon,
  PlayCircleIcon,
  TargetIcon,
} from "lucide-react";
import Link from "next/link";
import { courseHref, watchRequirementOf } from "./learning-view";
import type { LearningModule } from "./learning-view";
import { ModuleList, ModuleStateBadge } from "./module-list";
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

function Objectives({ objectives }: { objectives: readonly string[] }) {
  return (
    <section className="bg-card ring-divider flex flex-col gap-5 rounded-xl p-6 ring-1 md:p-8">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="bg-accent text-accent-foreground grid size-9 place-items-center rounded-full"
        >
          <TargetIcon className="size-4" />
        </span>
        <h2 className="font-display text-lg font-semibold">Learning objectives</h2>
      </div>
      {objectives.length === 0 ? (
        <p className="text-muted-foreground text-sm">No objectives are listed for this module.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {objectives.map((objective) => (
            <li key={objective} className="flex items-start gap-3 text-base leading-7">
              <CheckIcon
                aria-hidden="true"
                className="bg-primary text-primary-foreground mt-1 size-5 shrink-0 rounded-full p-1"
              />
              <span>{objective}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RoadmapPanel({
  courseSlug,
  modules,
  currentModuleId,
}: {
  courseSlug: string;
  modules: readonly LearningModule[];
  currentModuleId: string;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold">Course roadmap</h2>
      <ModuleList
        compact
        courseSlug={courseSlug}
        modules={modules}
        currentModuleId={currentModuleId}
      />
    </section>
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
    <article className="bg-card ring-divider flex flex-col gap-4 rounded-xl p-6 ring-1 md:p-10">
      <div className="border-border/50 flex items-center gap-3 border-b pb-6">
        <span
          aria-hidden="true"
          className="bg-accent text-accent-foreground grid size-9 place-items-center rounded-full"
        >
          <NotebookPenIcon className="size-4" />
        </span>
        <div className="flex flex-col">
          <span className="font-display text-lg leading-tight font-semibold">Lesson notes</span>
          <span className="text-muted-foreground text-xs">
            {sections.length} {sections.length === 1 ? "section" : "sections"} to read at your own
            pace
          </span>
        </div>
      </div>
      <div className="flex max-w-3xl flex-col">
        {sections.map((section, index) => {
          const rich = richSectionOf(section);
          return (
            <section
              key={section.id}
              aria-label={section.title === "" ? "Lesson" : section.title}
              className="border-border/50 flex flex-col gap-3 border-t py-8 text-base leading-8 first:border-t-0 first:pt-6 last:pb-0"
            >
              <span className="text-primary text-xs font-semibold tracking-widest uppercase">
                Part {index + 1} of {sections.length}
              </span>
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
    </article>
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
  const position = modules.findIndex((entry) => entry.id === module.id) + 1;
  const requirement = watchRequirementOf(module);
  return (
    <ShellContent>
      <header className="flex flex-col gap-3">
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
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-primary text-xs font-semibold tracking-widest uppercase">
              Module {position} of {modules.length}
            </span>
            <h1 className="font-display text-2xl leading-tight font-semibold md:text-3xl">
              {module.title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ModuleStateBadge state={module.state} />
            {requirement.total > 0 ? (
              <span className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
                <PlayCircleIcon aria-hidden="true" className="size-3.5" />
                {requirement.text}
              </span>
            ) : null}
          </div>
        </div>
      </header>
      {module.videos.length === 0 ? null : (
        <div className="bg-player rounded-2xl p-2 md:p-3">
          <div className="mx-auto w-full max-w-[calc((100svh-14rem)*16/9)] min-w-0">
            <VideoArea courseId={courseId} videos={module.videos} />
          </div>
        </div>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="xl:hidden">
            <QuizAction courseSlug={courseSlug} module={module} />
          </div>
          <Tabs defaultValue="objectives" data-layout="lesson-tabs" className="gap-4">
            <TabsList>
              <TabsTrigger value="objectives">
                <TargetIcon aria-hidden="true" />
                Objectives
              </TabsTrigger>
              <TabsTrigger value="lesson">
                <BookOpenTextIcon aria-hidden="true" />
                Lesson
              </TabsTrigger>
              <TabsTrigger value="modules" className="xl:hidden">
                <ListChecksIcon aria-hidden="true" />
                Modules
              </TabsTrigger>
            </TabsList>
            <TabsContent value="objectives">
              <Objectives objectives={module.objectives} />
            </TabsContent>
            <TabsContent value="lesson" keepMounted>
              <Sections lesson={lesson} />
            </TabsContent>
            <TabsContent value="modules">
              <RoadmapPanel courseSlug={courseSlug} modules={modules} currentModuleId={module.id} />
            </TabsContent>
          </Tabs>
        </div>
        <aside
          aria-label="Module navigation"
          className="flex flex-col gap-6 max-xl:hidden xl:sticky xl:top-6"
        >
          <QuizAction courseSlug={courseSlug} module={module} />
          <RoadmapPanel courseSlug={courseSlug} modules={modules} currentModuleId={module.id} />
        </aside>
      </div>
    </ShellContent>
  );
}

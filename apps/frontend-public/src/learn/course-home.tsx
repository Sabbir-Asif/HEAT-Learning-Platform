import { Button, EmptyState, SectionHeading } from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import type { LearningStructureResponse } from "@heat/contracts";
import { ArrowRightIcon, LayersIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ProgressRing } from "../dashboard/progress-ring";
import { EnrollmentNoticeView } from "./learn-states";
import { enrollmentNotice, moduleHref } from "./learning-view";
import { ModuleList } from "./module-list";

export function CourseHome({ response }: { response: LearningStructureResponse }) {
  const { course, learning } = response;
  if (learning === null) {
    return (
      <EnrollmentNoticeView
        courseTitle={course.title}
        notice={enrollmentNotice(response.enrollment.status, response.enrollment.reason)}
      />
    );
  }
  const { summary, modules } = learning;
  const next = summary.nextModuleId;
  return (
    <ShellContent className="gap-10">
      <header className="bg-sidebar text-sidebar-foreground relative flex flex-col gap-8 overflow-hidden rounded-xl p-6 md:flex-row md:items-center md:justify-between md:p-10">
        <Image
          src="/hero/campus-gathering.jpg"
          alt=""
          fill
          unoptimized
          sizes="100vw"
          className="object-cover opacity-25"
        />
        <span
          aria-hidden="true"
          className="from-sidebar via-sidebar/90 to-sidebar/40 absolute inset-0 bg-linear-to-r"
        />
        <div className="relative flex max-w-2xl flex-col gap-4">
          <p className="text-sidebar-primary text-xs font-semibold tracking-widest uppercase">
            Your course
          </p>
          <h1 className="font-display text-4xl leading-tight tracking-tight text-balance md:text-5xl">
            {course.title}
          </h1>
          {next === null ? null : (
            <div>
              <Button
                size="lg"
                variant="secondary"
                nativeButton={false}
                render={<Link href={moduleHref(course.slug, next)} />}
              >
                Continue learning
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </div>
          )}
        </div>
        <div className="bg-card text-card-foreground relative flex items-center gap-4 rounded-xl p-4 pr-6">
          <ProgressRing
            percent={summary.overallProgressPercent}
            label={`${summary.modulesCompleted} of ${summary.modulesTotal} modules completed`}
          />
          <p className="max-w-32 text-sm leading-snug font-medium text-balance">
            {summary.modulesCompleted} of {summary.modulesTotal} modules completed
          </p>
        </div>
      </header>
      <section aria-labelledby="course-roadmap" className="flex flex-col gap-5">
        <SectionHeading id="course-roadmap">Your roadmap</SectionHeading>
        {modules.length === 0 ? (
          <EmptyState
            icon={LayersIcon}
            title="No modules yet"
            description="The modules for this course are being prepared."
          />
        ) : (
          <ModuleList courseSlug={course.slug} modules={modules} />
        )}
      </section>
    </ShellContent>
  );
}

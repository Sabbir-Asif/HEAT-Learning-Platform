import type { DashboardCourse } from "@heat/contracts";
import { Button } from "@heat/ui";
import { ArrowRightIcon, ClockIcon } from "lucide-react";
import Link from "next/link";
import { courseHref } from "../learn/learning-view";
import { CourseCover } from "./course-cover";
import { continueTargetOf } from "./dashboard-view";
import { ProgressRing } from "./progress-ring";

export function FeaturedCourse({ course }: { course: DashboardCourse }) {
  const target = continueTargetOf(course);
  const { progress } = course;
  return (
    <section
      aria-label={`Continue ${course.courseTitle}`}
      className="bg-card ring-divider grid overflow-hidden rounded-xl ring-1 md:grid-cols-5"
    >
      <div className="relative min-h-48 md:col-span-2">
        <CourseCover
          thumbnail={course.thumbnail}
          sizes="(min-width: 768px) 40vw, 100vw"
          className="absolute inset-0"
          priority
        />
        <span className="bg-card/90 text-foreground absolute top-4 left-4 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase backdrop-blur">
          Up next
        </span>
      </div>
      <div className="flex flex-col gap-6 p-6 md:col-span-3 md:p-8">
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm font-medium">{course.courseTitle}</p>
          <h2 className="font-heading text-2xl leading-tight font-semibold text-balance md:text-3xl">
            {target === null ? course.courseTitle : target.moduleLabel}
          </h2>
          {target?.resumeHint == null ? null : (
            <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <ClockIcon aria-hidden="true" className="size-4" />
              {target.resumeHint}
            </p>
          )}
        </div>
        {progress === null ? null : (
          <div className="flex items-center gap-4">
            <ProgressRing
              percent={progress.percent}
              label={`${progress.modulesCompleted} of ${progress.modulesTotal} modules completed`}
            />
            <p className="flex flex-col leading-snug">
              <span className="font-semibold">
                {progress.modulesCompleted} of {progress.modulesTotal} modules completed
              </span>
              <span className="text-muted-foreground text-sm">
                Finish every quiz to earn your certificate.
              </span>
            </p>
          </div>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-3">
          {target === null ? null : (
            <Button size="lg" nativeButton={false} render={<Link href={target.href} />}>
              Continue learning
              <ArrowRightIcon data-icon="inline-end" />
              <span className="sr-only"> {course.courseTitle}</span>
            </Button>
          )}
          <Button
            size="lg"
            variant="ghost"
            nativeButton={false}
            render={<Link href={courseHref(course.courseSlug)} />}
          >
            All modules
            <span className="sr-only"> of {course.courseTitle}</span>
          </Button>
        </div>
      </div>
    </section>
  );
}

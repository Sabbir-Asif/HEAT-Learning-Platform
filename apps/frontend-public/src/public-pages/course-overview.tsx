import type { PublicCourseResponse } from "@heat/contracts";
import {
  BodyText,
  BulletList,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  SectionHeading,
} from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { LayersIcon, ListChecksIcon } from "lucide-react";
import { CourseCover } from "../dashboard/course-cover";
import { CourseEnrollAction } from "./course-enroll-action";
import { descriptionParagraphs } from "./links";

export function CourseOverview({ course }: { course: PublicCourseResponse }) {
  const moduleCount = course.modules.length;
  return (
    <ShellContent className="gap-10">
      <section
        aria-label="Course summary"
        className="bg-card ring-divider grid overflow-hidden rounded-xl ring-1 md:grid-cols-5"
      >
        <div className="flex flex-col justify-center gap-5 p-6 md:col-span-3 md:p-10">
          <span className="text-primary text-xs font-semibold tracking-widest uppercase">
            Course
          </span>
          <h1 className="font-heading text-3xl leading-tight font-bold text-balance md:text-4xl">
            {course.title}
          </h1>
          <span className="bg-muted text-muted-foreground inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
            <LayersIcon aria-hidden="true" className="size-3.5" />
            {moduleCount} {moduleCount === 1 ? "module" : "modules"}
          </span>
          <div>
            <CourseEnrollAction courseSlug={course.slug} courseTitle={course.title} />
          </div>
        </div>
        <CourseCover
          thumbnail={course.thumbnail}
          sizes="(min-width: 768px) 40vw, 100vw"
          className="aspect-video min-h-56 md:col-span-2 md:aspect-auto"
          priority
        />
      </section>
      <div className="grid gap-10 lg:grid-cols-3">
        <section aria-labelledby="about-heading" className="flex flex-col gap-4 lg:col-span-1">
          <SectionHeading id="about-heading">About this course</SectionHeading>
          {descriptionParagraphs(course.description).map((paragraph) => (
            <BodyText key={paragraph}>{paragraph}</BodyText>
          ))}
        </section>
        <section aria-labelledby="modules-heading" className="flex flex-col gap-4 lg:col-span-2">
          <SectionHeading id="modules-heading">Modules</SectionHeading>
          {course.modules.length === 0 ? (
            <EmptyState
              icon={ListChecksIcon}
              title="No modules yet"
              description="The modules for this course are being prepared."
            />
          ) : (
            <ol className="flex flex-col gap-4">
              {course.modules.map((module) => (
                <li key={module.id}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="font-heading text-secondary-foreground text-lg font-semibold">
                        {module.order}. {module.title}
                      </CardTitle>
                    </CardHeader>
                    {module.objectives.length === 0 ? null : (
                      <CardContent>
                        <BulletList>
                          {module.objectives.map((objective) => (
                            <li key={objective}>{objective}</li>
                          ))}
                        </BulletList>
                      </CardContent>
                    )}
                  </Card>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </ShellContent>
  );
}

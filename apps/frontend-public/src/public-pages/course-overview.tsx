import type { PublicCourseResponse } from "@heat/contracts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  SectionHeading,
} from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { ListChecksIcon } from "lucide-react";
import { CatalogImage } from "./catalog-image";
import { EnrollButton } from "./enroll-button";
import { descriptionParagraphs } from "./links";

export function CourseOverview({ course }: { course: PublicCourseResponse }) {
  return (
    <ShellContent>
      <PageHeader
        title={course.title}
        action={<EnrollButton courseSlug={course.slug} courseTitle={course.title} />}
      />
      {course.thumbnail === null ? null : (
        <CatalogImage image={course.thumbnail} sizes="(min-width: 1024px) 960px, 100vw" priority />
      )}
      {descriptionParagraphs(course.description).map((paragraph) => (
        <p key={paragraph} className="break-words">
          {paragraph}
        </p>
      ))}
      <section aria-labelledby="modules-heading" className="flex flex-col gap-4">
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
                <Card size="sm">
                  <CardHeader>
                    <CardTitle>
                      {module.order}. {module.title}
                    </CardTitle>
                  </CardHeader>
                  {module.objectives.length === 0 ? null : (
                    <CardContent>
                      <ul className="flex list-disc flex-col gap-1 pl-5">
                        {module.objectives.map((objective) => (
                          <li key={objective}>{objective}</li>
                        ))}
                      </ul>
                    </CardContent>
                  )}
                </Card>
              </li>
            ))}
          </ol>
        )}
      </section>
    </ShellContent>
  );
}

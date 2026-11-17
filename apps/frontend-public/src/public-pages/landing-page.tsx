import { parseRichText } from "@heat/contracts";
import type { PublicFrontPageResponse, PublicLandingOverviewResponse } from "@heat/contracts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  SectionHeading,
} from "@heat/ui";
import { RichTextRenderer } from "@heat/ui/content";
import { ShellContent } from "@heat/ui/shell";
import { BookOpenIcon } from "lucide-react";
import { CatalogImage } from "./catalog-image";
import { CourseCard } from "./course-card";
import { EnrollButton } from "./enroll-button";

interface LandingPageProps {
  overview: PublicLandingOverviewResponse;
  frontPage: PublicFrontPageResponse;
}

function Overview({ overview }: { overview: PublicLandingOverviewResponse }) {
  const parsed = parseRichText(overview.body);
  return (
    <section aria-label="Overview" className="grid items-center gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-4">
        <PageHeader title={overview.heading} />
        {parsed.ok ? <RichTextRenderer document={parsed.doc} images={overview.images} /> : null}
      </div>
      {overview.image === null ? null : (
        <CatalogImage image={overview.image} sizes="(min-width: 768px) 50vw, 100vw" priority />
      )}
    </section>
  );
}

export function LandingPage({ overview, frontPage }: LandingPageProps) {
  return (
    <ShellContent>
      <Overview overview={overview} />
      <section aria-labelledby="courses-heading" className="flex flex-col gap-4">
        <SectionHeading id="courses-heading">Courses</SectionHeading>
        {frontPage.courses.length === 0 ? (
          <EmptyState
            icon={BookOpenIcon}
            title="No courses yet"
            description="Courses will appear here when they are published."
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {frontPage.courses.map((course) => (
              <li key={course.id}>
                <CourseCard course={course} />
              </li>
            ))}
          </ul>
        )}
      </section>
      {frontPage.modules.length === 0 ? null : (
        <section aria-labelledby="modules-heading" className="flex flex-col gap-4">
          <SectionHeading id="modules-heading">Modules</SectionHeading>
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {frontPage.modules.map((module) => (
              <li key={module.id}>
                <Card size="sm" className="h-full">
                  <CardHeader>
                    <CardTitle>{module.title}</CardTitle>
                    <CardDescription>Part of {module.courseTitle}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EnrollButton courseSlug={module.courseSlug} courseTitle={module.courseTitle} />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </ShellContent>
  );
}

import type { PublicFrontPageResponse } from "@heat/contracts";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@heat/ui";
import Link from "next/link";
import { CatalogImage } from "./catalog-image";
import { CourseEnrollAction } from "./course-enroll-action";
import { courseHref } from "./links";

type FrontPageCourse = PublicFrontPageResponse["courses"][number];

export function CourseCard({ course }: { course: FrontPageCourse }) {
  return (
    <Card className="h-full">
      {course.thumbnail === null ? null : (
        <CatalogImage image={course.thumbnail} sizes="(min-width: 768px) 33vw, 100vw" />
      )}
      <CardHeader>
        <CardTitle>{course.title}</CardTitle>
        {course.description === null ? null : (
          <CardDescription>{course.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="mt-auto flex flex-wrap items-center gap-2">
        <CourseEnrollAction courseSlug={course.slug} courseTitle={course.title} />
        <Button
          variant="ghost"
          nativeButton={false}
          render={<Link href={courseHref(course.slug)} />}
        >
          View course
          <span className="sr-only"> {course.title}</span>
        </Button>
      </CardContent>
    </Card>
  );
}

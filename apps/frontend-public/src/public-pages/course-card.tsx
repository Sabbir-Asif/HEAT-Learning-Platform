import type { PublicFrontPageResponse } from "@heat/contracts";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@heat/ui";
import Link from "next/link";
import { CatalogImage } from "./catalog-image";
import { EnrollButton } from "./enroll-button";
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
      <CardContent className="flex flex-wrap gap-2">
        <EnrollButton courseSlug={course.slug} courseTitle={course.title} />
        <Button
          variant="outline"
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

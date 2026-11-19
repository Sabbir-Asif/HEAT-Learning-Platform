import { Button, EmptyState, PageHeader } from "@heat/ui";
import { ArrowRightIcon, BookOpenIcon } from "lucide-react";
import Link from "next/link";
import { enrollHref } from "../public-pages/links";

export interface EnrollableCourse {
  slug: string;
  title: string;
  description: string | null;
}

export function CourseRequired({ courses = [] }: { courses?: readonly EnrollableCourse[] }) {
  if (courses.length === 0) {
    return (
      <>
        <PageHeader title="Enroll" />
        <EmptyState
          icon={BookOpenIcon}
          title="Choose a course to enroll in"
          description="Open a course and use its Enroll button."
          action={
            <Button variant="outline" nativeButton={false} render={<Link href="/#courses" />}>
              Browse courses
            </Button>
          }
        />
      </>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Enroll" description="Choose the course you want to join." />
      <ul className="flex flex-col gap-3">
        {courses.map((course) => (
          <li key={course.slug}>
            <Link
              href={enrollHref(course.slug)}
              className="ring-divider hover:bg-accent focus-visible:ring-ring group flex items-center gap-4 rounded-xl p-4 ring-1 transition-colors outline-none focus-visible:ring-2"
            >
              <span className="bg-accent text-accent-foreground grid size-11 shrink-0 place-items-center rounded-xl">
                <BookOpenIcon aria-hidden="true" className="size-5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-heading font-semibold">{course.title}</span>
                {course.description === null ? null : (
                  <span className="text-muted-foreground line-clamp-2 text-sm">
                    {course.description}
                  </span>
                )}
              </span>
              <ArrowRightIcon
                aria-hidden="true"
                className="text-muted-foreground size-5 transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

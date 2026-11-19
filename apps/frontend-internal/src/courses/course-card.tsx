import type { CourseListResponseDtoItemsItem } from "@heat/api-client";
import { Card, StatusBadge } from "@heat/ui";
import { CalendarIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatDhakaTime } from "../admins/admin-copy";
import { CourseThumbnail } from "./course-thumbnail";

type CourseCardProps = {
  course: CourseListResponseDtoItemsItem;
  actions: ReactNode;
  priority?: boolean;
};

export function CourseCard({ course, actions, priority = false }: CourseCardProps) {
  return (
    <Card className="group/course relative gap-0 py-0 transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative">
        <CourseThumbnail title={course.title} thumbnail={course.thumbnail} priority={priority} />
        <StatusBadge
          kind="course"
          status={course.status}
          className="absolute top-3 left-3 shadow-sm"
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-lg leading-snug font-semibold text-balance">
            <Link
              href={`/courses/${course.id}`}
              className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
            >
              {course.title}
            </Link>
          </h2>
          <p className="text-muted-foreground text-xs">/{course.slug}</p>
        </div>
        {course.description === null ? null : (
          <p className="text-muted-foreground line-clamp-2 text-sm">{course.description}</p>
        )}
        <dl className="text-muted-foreground mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs">
          <div className="flex items-center gap-1.5">
            <UsersIcon aria-hidden="true" className="size-3.5" />
            <dt className="sr-only">Enrollments</dt>
            <dd>{course.enrollmentCount} enrolled</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <CalendarIcon aria-hidden="true" className="size-3.5" />
            <dt className="sr-only">Updated</dt>
            <dd>{formatDhakaTime(course.updatedAt)}</dd>
          </div>
        </dl>
      </div>
      <div className="bg-muted/50 relative z-10 flex items-center justify-end gap-1 border-t px-3 py-2">
        {actions}
      </div>
    </Card>
  );
}

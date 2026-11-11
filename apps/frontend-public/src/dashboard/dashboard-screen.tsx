"use client";

import { useDashboardDescribe } from "@heat/api-client";
import { PageHeader, SectionHeading } from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { DashboardCourseCard } from "./dashboard-course-card";
import { DashboardEmpty, DashboardError, DashboardLoading } from "./dashboard-states";
import { groupDashboardCourses } from "./dashboard-view";

export function DashboardScreen() {
  const dashboard = useDashboardDescribe();
  if (dashboard.isPending) return <DashboardLoading />;
  if (dashboard.isError) return <DashboardError onRetry={() => void dashboard.refetch()} />;
  const groups = groupDashboardCourses(dashboard.data.courses);
  if (groups.length === 0) return <DashboardEmpty />;
  return (
    <ShellContent>
      <PageHeader title="My learning" />
      {groups.map((group) => (
        <section
          key={group.key}
          aria-labelledby={`dashboard-${group.key}`}
          className="flex flex-col gap-3"
        >
          <SectionHeading id={`dashboard-${group.key}`}>{group.title}</SectionHeading>
          <ul className="grid gap-4 md:grid-cols-2">
            {group.courses.map((course) => (
              <li key={course.courseId}>
                <DashboardCourseCard course={course} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </ShellContent>
  );
}

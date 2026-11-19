"use client";

import { useDashboardDescribe } from "@heat/api-client";
import { PageHeader, SectionHeading } from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { DashboardCourseCard } from "./dashboard-course-card";
import { DashboardEmpty, DashboardError, DashboardLoading } from "./dashboard-states";
import { groupDashboardCourses } from "./dashboard-view";

export function MyLearningScreen() {
  const dashboard = useDashboardDescribe();
  if (dashboard.isPending) return <DashboardLoading />;
  if (dashboard.isError) return <DashboardError onRetry={() => void dashboard.refetch()} />;
  const groups = groupDashboardCourses(dashboard.data.courses);
  if (groups.length === 0) return <DashboardEmpty />;
  return (
    <ShellContent className="gap-8">
      <PageHeader
        title="My learning"
        description="Every course you have enrolled in, with your progress in each."
      />
      {groups.map((group) => (
        <section
          key={group.key}
          aria-labelledby={`learning-${group.key}`}
          className="flex flex-col gap-4"
        >
          <SectionHeading id={`learning-${group.key}`}>{group.title}</SectionHeading>
          <ul className="flex flex-col gap-3">
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

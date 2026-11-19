"use client";

import { useDashboardDescribe } from "@heat/api-client";
import { SectionHeading } from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { useStudentSession } from "../auth/use-student-session";
import { DashboardCourseCard } from "./dashboard-course-card";
import { DashboardHero } from "./dashboard-hero";
import { DashboardEmpty, DashboardError, DashboardLoading } from "./dashboard-states";
import { groupDashboardCourses } from "./dashboard-view";
import { FeaturedCourse } from "./featured-course";

export function DashboardScreen() {
  const dashboard = useDashboardDescribe();
  const session = useStudentSession();
  if (dashboard.isPending) return <DashboardLoading />;
  if (dashboard.isError) return <DashboardError onRetry={() => void dashboard.refetch()} />;
  const { courses } = dashboard.data;
  const groups = groupDashboardCourses(courses);
  if (groups.length === 0) return <DashboardEmpty />;
  const featured = courses.find(
    (course) => course.status === "APPROVED" && course.nextModule !== null,
  );
  const totals = {
    courses: courses.length,
    modulesCompleted: courses.reduce(
      (sum, course) => sum + (course.progress?.modulesCompleted ?? 0),
      0,
    ),
    certificates: courses.filter((course) => course.certificate?.status === "READY").length,
  };
  return (
    <ShellContent className="gap-10">
      <DashboardHero
        {...(session.kind === "signed-in" && session.session.user.name !== undefined
          ? { name: session.session.user.name }
          : {})}
        totals={totals}
      />
      {featured === undefined ? null : <FeaturedCourse course={featured} />}
      {groups.map((group) => {
        const rest = group.courses.filter((course) => course !== featured);
        if (rest.length === 0) return null;
        return (
          <section
            key={group.key}
            aria-labelledby={`dashboard-${group.key}`}
            className="flex flex-col gap-4"
          >
            <SectionHeading id={`dashboard-${group.key}`}>{group.title}</SectionHeading>
            <ul className="flex flex-col gap-3">
              {rest.map((course) => (
                <li key={course.courseId}>
                  <DashboardCourseCard course={course} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </ShellContent>
  );
}

import { Button, EmptyState, PageHeader, Progress, ProgressLabel } from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import type { LearningStructureResponse } from "@heat/contracts";
import { LayersIcon } from "lucide-react";
import Link from "next/link";
import { EnrollmentNoticeView } from "./learn-states";
import { enrollmentNotice, moduleHref } from "./learning-view";
import { ModuleList } from "./module-list";

export function CourseHome({ response }: { response: LearningStructureResponse }) {
  const { course, learning } = response;
  if (learning === null) {
    return (
      <EnrollmentNoticeView
        courseTitle={course.title}
        notice={enrollmentNotice(response.enrollment.status, response.enrollment.reason)}
      />
    );
  }
  const { summary, modules } = learning;
  const next = summary.nextModuleId;
  return (
    <ShellContent>
      <PageHeader
        title={course.title}
        action={
          next === null ? null : (
            <Button nativeButton={false} render={<Link href={moduleHref(course.slug, next)} />}>
              Continue learning
            </Button>
          )
        }
      />
      <Progress value={summary.overallProgressPercent}>
        <ProgressLabel>
          {summary.modulesCompleted} of {summary.modulesTotal} modules completed
        </ProgressLabel>
      </Progress>
      {modules.length === 0 ? (
        <EmptyState
          icon={LayersIcon}
          title="No modules yet"
          description="The modules for this course are being prepared."
        />
      ) : (
        <ModuleList courseSlug={course.slug} modules={modules} />
      )}
    </ShellContent>
  );
}

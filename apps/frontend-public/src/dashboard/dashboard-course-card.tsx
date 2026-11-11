import type { DashboardCourse } from "@heat/contracts";
import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
  ProgressLabel,
  StatusBadge,
} from "@heat/ui";
import Link from "next/link";
import { certificateHrefOf, continueTargetOf } from "./dashboard-view";

export function DashboardCourseCard({ course }: { course: DashboardCourse }) {
  const target = continueTargetOf(course);
  const certificateHref = certificateHrefOf(course);
  const { progress } = course;
  return (
    <Card size="sm" className="h-full">
      <CardHeader>
        <CardTitle>{course.courseTitle}</CardTitle>
        <CardAction>
          <StatusBadge kind="enrollment" status={course.status} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {progress === null ? null : (
          <Progress value={progress.percent}>
            <ProgressLabel>
              {progress.modulesCompleted} of {progress.modulesTotal} modules completed
            </ProgressLabel>
          </Progress>
        )}
        {target === null ? null : (
          <>
            <CardDescription>
              {target.moduleLabel}
              {target.resumeHint === null ? null : ` · ${target.resumeHint}`}
            </CardDescription>
            <div>
              <Button nativeButton={false} render={<Link href={target.href} />}>
                Continue learning
                <span className="sr-only"> {course.courseTitle}</span>
              </Button>
            </div>
          </>
        )}
        {certificateHref === null ? null : (
          <div>
            <Button variant="outline" nativeButton={false} render={<Link href={certificateHref} />}>
              View certificate
              <span className="sr-only"> for {course.courseTitle}</span>
            </Button>
          </div>
        )}
        {course.reason === null ? null : <CardDescription>Reason: {course.reason}</CardDescription>}
      </CardContent>
    </Card>
  );
}

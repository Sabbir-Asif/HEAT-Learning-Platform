import type { DashboardCourse } from "@heat/contracts";
import { Button, StatusBadge } from "@heat/ui";
import { DownloadIcon } from "lucide-react";
import Link from "next/link";
import { dashboardCertificateOf } from "../certificates/certificate-view";
import { CourseCover } from "./course-cover";
import { continueTargetOf } from "./dashboard-view";
import { ProgressRing } from "./progress-ring";

export function DashboardCourseCard({ course }: { course: DashboardCourse }) {
  const target = continueTargetOf(course);
  const certificate = dashboardCertificateOf(course);
  const { progress } = course;
  return (
    <article className="bg-card ring-divider flex flex-col overflow-hidden rounded-xl ring-1 sm:flex-row">
      <CourseCover
        thumbnail={course.thumbnail}
        sizes="(min-width: 640px) 16rem, 100vw"
        className="aspect-video w-full shrink-0 sm:aspect-auto sm:min-h-40 sm:w-64"
      />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-5 p-5">
        {progress === null ? null : (
          <ProgressRing
            className="size-16"
            percent={progress.percent}
            label={`${progress.modulesCompleted} of ${progress.modulesTotal} modules completed`}
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-lg font-semibold">{course.courseTitle}</h3>
            <StatusBadge kind="enrollment" status={course.status} />
          </div>
          {progress === null ? null : (
            <p className="text-muted-foreground text-sm">
              {progress.modulesCompleted} of {progress.modulesTotal} modules completed
            </p>
          )}
          {target === null ? null : (
            <p className="text-muted-foreground text-sm">
              {target.moduleLabel}
              {target.resumeHint === null ? null : ` · ${target.resumeHint}`}
            </p>
          )}
          {certificate?.kind === "pending" ? (
            <p className="text-muted-foreground text-sm">Your certificate is being prepared.</p>
          ) : null}
          {certificate?.kind === "revoked" ? (
            <p className="text-muted-foreground text-sm">This certificate has been revoked.</p>
          ) : null}
          {course.reason === null ? null : (
            <p className="text-muted-foreground text-sm">Reason: {course.reason}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {target === null ? null : (
            <Button nativeButton={false} render={<Link href={target.href} />}>
              Continue learning
              <span className="sr-only"> {course.courseTitle}</span>
            </Button>
          )}
          {certificate?.kind === "ready" ? (
            <>
              <Button nativeButton={false} render={<a href={certificate.downloadHref} />}>
                <DownloadIcon data-icon="inline-start" />
                Download certificate
                <span className="sr-only"> for {course.courseTitle}</span>
              </Button>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={certificate.viewHref} />}
              >
                View certificate
                <span className="sr-only"> for {course.courseTitle}</span>
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}

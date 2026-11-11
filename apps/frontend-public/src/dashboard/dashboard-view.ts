import { grantsCourseAccess } from "@heat/contracts";
import type { DashboardCourse } from "@heat/contracts";
import { moduleHref } from "../learn/learning-view";

export type DashboardGroupKey = "inProgress" | "completed" | "pending" | "removed";

export interface DashboardGroup {
  key: DashboardGroupKey;
  title: string;
  courses: DashboardCourse[];
}

const groupOfStatus: Record<DashboardCourse["status"], DashboardGroupKey> = {
  APPROVED: "inProgress",
  COMPLETED: "completed",
  PENDING_VERIFICATION: "pending",
  PENDING_APPROVAL: "pending",
  REMOVED: "removed",
  REJECTED: "removed",
  EXPIRED: "removed",
};

const groupTitles: Record<DashboardGroupKey, string> = {
  inProgress: "In progress",
  completed: "Completed",
  pending: "Waiting for approval",
  removed: "Removed or closed",
};

const groupOrder: readonly DashboardGroupKey[] = ["inProgress", "completed", "pending", "removed"];

export const groupDashboardCourses = (courses: readonly DashboardCourse[]): DashboardGroup[] =>
  groupOrder
    .map((key) => ({
      key,
      title: groupTitles[key],
      courses: courses.filter((course) => groupOfStatus[course.status] === key),
    }))
    .filter((group) => group.courses.length > 0);

export const awaitingApprovalPath = "/awaiting-approval";

export const dashboardRedirectPath = (courses: readonly DashboardCourse[]): string | null =>
  courses.some((course) => grantsCourseAccess(course.status) || course.status === "REMOVED")
    ? null
    : awaitingApprovalPath;

export const formatResumePosition = (seconds: number): string => {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = String(whole % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
};

export interface ContinueTarget {
  href: string;
  moduleLabel: string;
  resumeHint: string | null;
}

export const continueTargetOf = (course: DashboardCourse): ContinueTarget | null => {
  if (course.status !== "APPROVED" || course.nextModule === null) return null;
  const { nextModule } = course;
  return {
    href: moduleHref(course.courseSlug, nextModule.id),
    moduleLabel: `Module ${nextModule.order}: ${nextModule.title}`,
    resumeHint:
      nextModule.resumeVideoId === null
        ? null
        : `Resume at ${formatResumePosition(nextModule.resumePositionSeconds)}`,
  };
};

export const certificateHrefOf = (course: DashboardCourse): string | null =>
  course.status === "COMPLETED" && course.certificateNumber !== null
    ? `/verify/${encodeURIComponent(course.certificateNumber)}`
    : null;

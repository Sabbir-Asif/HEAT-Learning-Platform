import { videoCompletionThreshold } from "@heat/contracts";
import type {
  LearningContent,
  LearningEnrollmentStatus,
  LearningModuleState,
  LearningStructureResponse,
} from "@heat/contracts";

export type LearningModule = LearningContent["modules"][number];

export const moduleStateLabel: Record<LearningModuleState, string> = {
  LOCKED: "Locked",
  UNLOCKED: "Unlocked",
  IN_PROGRESS: "In progress",
  QUIZ_READY: "Quiz ready",
  COMPLETED: "Completed",
};

export const moduleActionLabel: Record<LearningModuleState, string> = {
  LOCKED: "Locked",
  UNLOCKED: "Start",
  IN_PROGRESS: "Continue",
  QUIZ_READY: "Continue",
  COMPLETED: "Review",
};

export const videoStatusText = (video: LearningModule["videos"][number]): string => {
  if (video.status === "UNAVAILABLE") return "This video is not available yet.";
  if (video.status === "COMPLETED") return "Watched";
  if (video.status === "IN_PROGRESS") return `${video.coveragePercent}% watched`;
  return "Not started";
};

export const quizSummaryOf = (courseSlug: string, module: LearningModule): string | null => {
  const action = quizActionOf(courseSlug, module);
  if (action.kind === "none") return null;
  if (action.kind === "done") return "Quiz passed";
  if (action.kind === "open") return "Quiz available";
  return action.reason;
};

export const moduleHref = (courseSlug: string, moduleId: string): string =>
  `/learn/${encodeURIComponent(courseSlug)}/${encodeURIComponent(moduleId)}`;

export const courseHref = (courseSlug: string): string =>
  `/learn/${encodeURIComponent(courseSlug)}`;

const thresholdPercent = Math.round(videoCompletionThreshold * 100);

const plural = (count: number, singular: string): string =>
  count === 1 ? singular : `${singular}s`;

export interface WatchRequirement {
  completed: number;
  total: number;
  remaining: number;
  percent: number;
  text: string;
}

export const watchRequirementOf = (module: LearningModule): WatchRequirement => {
  const { requiredVideosCompleted: completed, requiredVideosTotal: total } = module;
  return {
    completed,
    total,
    remaining: Math.max(0, total - completed),
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    text: `${completed} of ${total} required ${plural(total, "video")} watched`,
  };
};

export type QuizAction =
  | { kind: "none" }
  | { kind: "open"; href: string }
  | { kind: "disabled"; reason: string }
  | { kind: "done" };

const attemptTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Dhaka",
  hourCycle: "h23",
});

export const formatAttemptTime = (iso: string): string => {
  const parts = attemptTime.formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("day")} ${part("month")} ${part("year")}, ${part("hour")}:${part("minute")}`;
};

const watchReason = (module: LearningModule): string => {
  const { remaining, total } = watchRequirementOf(module);
  if (total === 0) return "Finish this module to unlock the quiz.";
  if (remaining === total) {
    return `Watch the ${total} required ${plural(total, "video")} to at least ${thresholdPercent}% to unlock the quiz.`;
  }
  return `Watch ${remaining} more required ${plural(remaining, "video")} to at least ${thresholdPercent}% to unlock the quiz.`;
};

export const quizActionOf = (courseSlug: string, module: LearningModule): QuizAction => {
  const { quiz } = module;
  if (quiz === null) return { kind: "none" };
  if (module.state === "COMPLETED" || quiz.availability === "PASSED") return { kind: "done" };
  if (module.state === "LOCKED") {
    return { kind: "disabled", reason: "Finish the previous module to unlock this quiz." };
  }
  if (module.state !== "QUIZ_READY") return { kind: "disabled", reason: watchReason(module) };
  if (quiz.availability === "EXHAUSTED") {
    return { kind: "disabled", reason: "You have used all attempts for this quiz." };
  }
  if (quiz.availability === "WAITING" && quiz.nextAttemptAt !== null) {
    return {
      kind: "disabled",
      reason: `You can try again on ${formatAttemptTime(quiz.nextAttemptAt)}.`,
    };
  }
  if (quiz.availability !== "AVAILABLE") {
    return { kind: "disabled", reason: watchReason(module) };
  }
  return { kind: "open", href: `${moduleHref(courseSlug, module.id)}/quiz` };
};

const noticeCopy: Record<Exclude<LearningEnrollmentStatus, "APPROVED" | "COMPLETED">, string> = {
  PENDING_VERIFICATION: "Verify your email address to continue.",
  PENDING_APPROVAL: "An administrator is reviewing your request.",
  REJECTED: "Your request was not approved.",
  EXPIRED: "This request expired before the email address was verified.",
  REMOVED: "Your access to this course was removed.",
};

export interface EnrollmentNotice {
  status: LearningEnrollmentStatus;
  description: string;
  reason: string | null;
}

export const enrollmentNotice = (
  status: LearningEnrollmentStatus,
  reason: string | null,
): EnrollmentNotice => ({
  status,
  description: status === "APPROVED" || status === "COMPLETED" ? "" : noticeCopy[status],
  reason,
});

export type LessonView =
  | { kind: "status"; notice: EnrollmentNotice }
  | { kind: "missing" }
  | { kind: "locked"; module: LearningModule; reason: string; courseSlug: string }
  | {
      kind: "ready";
      module: LearningModule;
      modules: LearningModule[];
      courseSlug: string;
      courseTitle: string;
    };

export const lockedReason = (modules: readonly LearningModule[], index: number): string => {
  const previous = modules[index - 1];
  return previous === undefined
    ? "This module is not open yet."
    : `Finish "${previous.title}" and pass its quiz to open this module.`;
};

export const lessonViewOf = (response: LearningStructureResponse, moduleId: string): LessonView => {
  if (response.learning === null) {
    return {
      kind: "status",
      notice: enrollmentNotice(response.enrollment.status, response.enrollment.reason),
    };
  }
  const { modules } = response.learning;
  const index = modules.findIndex((entry) => entry.id === moduleId);
  const entry = modules[index];
  if (entry === undefined) return { kind: "missing" };
  const courseSlug = response.course.slug;
  if (entry.state === "LOCKED") {
    return { kind: "locked", module: entry, reason: lockedReason(modules, index), courseSlug };
  }
  return { kind: "ready", module: entry, modules, courseSlug, courseTitle: response.course.title };
};

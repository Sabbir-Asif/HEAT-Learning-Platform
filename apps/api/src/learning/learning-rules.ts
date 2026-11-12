import { videoCompletionThreshold } from "@heat/contracts";
import type {
  LearningModuleState,
  LearningQuizAvailability,
  LearningVideoStatus,
} from "@heat/contracts";

export interface VideoFacts {
  assetReady: boolean;
  coverage: number;
  resumePositionSeconds: number;
  completedAt: Date | null;
}

export const isVideoWatched = (facts: { coverage: number; completedAt: Date | null }): boolean =>
  facts.completedAt !== null || facts.coverage >= videoCompletionThreshold;

export const requiredVideosWatched = (
  videos: readonly { required: boolean; coverage: number; completedAt: Date | null }[],
): boolean => videos.every((video) => !video.required || isVideoWatched(video));

export const videoStatusOf = (facts: VideoFacts): LearningVideoStatus => {
  if (!facts.assetReady) return "UNAVAILABLE";
  if (isVideoWatched(facts)) return "COMPLETED";
  if (facts.coverage > 0 || facts.resumePositionSeconds > 0) return "IN_PROGRESS";
  return "NOT_STARTED";
};

export const requiredVideoCompletion = (
  videos: readonly { required: boolean; status: LearningVideoStatus }[],
): { completed: number; total: number } => {
  const required = videos.filter((video) => video.required);
  return {
    completed: required.filter((video) => video.status === "COMPLETED").length,
    total: required.length,
  };
};

export const effectiveModuleStates = (
  enrollmentStatus: "APPROVED" | "COMPLETED",
  stored: readonly (LearningModuleState | null)[],
  watched: readonly boolean[] = [],
): LearningModuleState[] => {
  if (enrollmentStatus === "COMPLETED") return stored.map(() => "COMPLETED");
  const states: LearningModuleState[] = [];
  stored.forEach((status, index) => {
    const base =
      index === 0
        ? (status ?? "UNLOCKED")
        : states[index - 1] === "COMPLETED"
          ? (status ?? "LOCKED")
          : "LOCKED";
    const reachesQuiz = (base === "UNLOCKED" || base === "IN_PROGRESS") && watched[index] === true;
    states.push(reachesQuiz ? "QUIZ_READY" : base);
  });
  return states;
};

export const quizUnlocked = (state: LearningModuleState): boolean =>
  state === "QUIZ_READY" || state === "COMPLETED";

const workable: readonly LearningModuleState[] = ["UNLOCKED", "IN_PROGRESS", "QUIZ_READY"];

export const nextModuleIndex = (states: readonly LearningModuleState[]): number | null => {
  const index = states.findIndex((state) => workable.includes(state));
  return index === -1 ? null : index;
};

export const overallProgressPercent = (states: readonly LearningModuleState[]): number =>
  states.length === 0
    ? 0
    : Math.round((states.filter((state) => state === "COMPLETED").length / states.length) * 100);

export interface QuizFacts {
  attemptLimit: number | null;
  waitMinutes: number;
  extraAttempts: number;
  attempts: readonly { passed: boolean | null; submittedAt: Date }[];
}

export interface QuizState {
  availability: LearningQuizAvailability;
  attemptsUsed: number;
  attemptsAllowed: number | null;
  nextAttemptAt: string | null;
}

const minute = 60_000;

export const quizStateOf = (
  moduleState: LearningModuleState,
  facts: QuizFacts,
  now: Date,
): QuizState => {
  const attemptsUsed = facts.attempts.length;
  const attemptsAllowed =
    facts.attemptLimit === null ? null : facts.attemptLimit + facts.extraAttempts;
  const base = { attemptsUsed, attemptsAllowed, nextAttemptAt: null };
  if (moduleState === "COMPLETED" || facts.attempts.some((attempt) => attempt.passed === true)) {
    return { ...base, availability: "PASSED" };
  }
  if (moduleState !== "QUIZ_READY") return { ...base, availability: "UNAVAILABLE" };
  if (attemptsAllowed !== null && attemptsUsed >= attemptsAllowed) {
    return { ...base, availability: "EXHAUSTED" };
  }
  const latest = facts.attempts.reduce<Date | null>(
    (current, attempt) =>
      current === null || attempt.submittedAt > current ? attempt.submittedAt : current,
    null,
  );
  if (latest !== null) {
    const retryAt = new Date(latest.getTime() + facts.waitMinutes * minute);
    if (retryAt > now) {
      return { ...base, availability: "WAITING", nextAttemptAt: retryAt.toISOString() };
    }
  }
  return { ...base, availability: "AVAILABLE" };
};

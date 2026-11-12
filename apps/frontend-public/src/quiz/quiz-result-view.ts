import type { LearningModule } from "../learn/learning-view";
import { moduleHref } from "../learn/learning-view";

export type ResultNextStep =
  | { kind: "next-module"; title: string; href: string }
  | { kind: "certificate" }
  | { kind: "wait"; nextAttemptAt: string; retryHref: string; attemptsRemaining: number | null }
  | { kind: "retry"; retryHref: string; attemptsRemaining: number | null }
  | { kind: "limit-reached" };

export const remainingSecondsOf = (nextAttemptAt: string, now: Date): number =>
  Math.max(0, Math.ceil((new Date(nextAttemptAt).getTime() - now.getTime()) / 1000));

const twoDigits = (value: number): string => String(value).padStart(2, "0");

export const countdownText = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${twoDigits(minutes)}:${twoDigits(seconds)}`
    : `${minutes}:${twoDigits(seconds)}`;
};

export const resultNextStepOf = (
  passed: boolean,
  modules: readonly LearningModule[],
  index: number,
  courseSlug: string,
): ResultNextStep => {
  if (passed) {
    const next = modules[index + 1];
    return next === undefined
      ? { kind: "certificate" }
      : { kind: "next-module", title: next.title, href: moduleHref(courseSlug, next.id) };
  }
  const current = modules[index];
  const quiz = current?.quiz ?? null;
  if (current === undefined || quiz === null) return { kind: "limit-reached" };
  if (quiz.availability === "EXHAUSTED") return { kind: "limit-reached" };
  const retryHref = `${moduleHref(courseSlug, current.id)}/quiz`;
  const attemptsRemaining =
    quiz.attemptsAllowed === null ? null : Math.max(0, quiz.attemptsAllowed - quiz.attemptsUsed);
  if (quiz.availability === "WAITING" && quiz.nextAttemptAt !== null) {
    return { kind: "wait", nextAttemptAt: quiz.nextAttemptAt, retryHref, attemptsRemaining };
  }
  return { kind: "retry", retryHref, attemptsRemaining };
};

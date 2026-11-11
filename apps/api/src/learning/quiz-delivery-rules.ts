import { createHash } from "node:crypto";
import type { QuizDeliveryQuestion, QuizPastResult } from "@heat/contracts";

export interface DeliverableOption {
  id: string;
  text: string;
}

export interface DeliverableQuestion {
  id: string;
  order: number;
  text: string;
  options: readonly DeliverableOption[];
}

const seedOf = (value: string): number =>
  createHash("sha256").update(value).digest().readUInt32BE(0);

const randomFrom = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const seededShuffle = <T>(items: readonly T[], seed: string): T[] => {
  const result = [...items];
  const random = randomFrom(seedOf(seed));
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const held = result[index] as T;
    result[index] = result[swap] as T;
    result[swap] = held;
  }
  return result;
};

export const deliverQuestions = (
  attemptId: string,
  questions: readonly DeliverableQuestion[],
): QuizDeliveryQuestion[] =>
  questions.map((question) => ({
    id: question.id,
    order: question.order,
    text: question.text,
    options: seededShuffle(
      question.options.map((option) => ({ id: option.id, text: option.text })),
      `${attemptId}:${question.id}`,
    ),
  }));

export const attemptIdempotencyKey = (attemptsUsed: number): string =>
  `attempt-${attemptsUsed + 1}`;

export interface ScoredAttempt {
  id: string;
  scorePercent: number | null;
  passed: boolean | null;
  submittedAt: Date | null;
}

export const bestResultOf = (attempts: readonly ScoredAttempt[]): QuizPastResult | null => {
  let best: { attempt: ScoredAttempt; score: number; submittedAt: Date } | null = null;
  for (const attempt of attempts) {
    if (attempt.scorePercent === null || attempt.submittedAt === null) continue;
    if (best === null || attempt.scorePercent > best.score) {
      best = { attempt, score: attempt.scorePercent, submittedAt: attempt.submittedAt };
    }
  }
  if (best === null) return null;
  return {
    attemptId: best.attempt.id,
    scorePercent: best.score,
    passed: best.attempt.passed === true,
    submittedAt: best.submittedAt.toISOString(),
  };
};

export const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";

import type { QuizOptionRequest, QuizRulesRequest } from "@heat/contracts";
import { assertContentUnlocked } from "./module-rules";

export const rulesChanged = (current: QuizRulesRequest, next: QuizRulesRequest): boolean =>
  current.passMarkPercent !== next.passMarkPercent ||
  current.attemptLimit !== next.attemptLimit ||
  current.waitMinutes !== next.waitMinutes;

export const optionsChanged = (
  current: readonly QuizOptionRequest[],
  next: readonly QuizOptionRequest[],
): boolean =>
  current.length !== next.length ||
  current.some(
    (option, index) =>
      option.text !== next[index]?.text || option.isCorrect !== next[index]?.isCorrect,
  );

export const assertRulesUnlocked = (
  lockedAt: Date | null,
  current: QuizRulesRequest,
  next: QuizRulesRequest,
): void => {
  if (rulesChanged(current, next)) assertContentUnlocked(lockedAt);
};

export const assertOptionsUnlocked = (
  lockedAt: Date | null,
  current: readonly QuizOptionRequest[],
  next: readonly QuizOptionRequest[],
): void => {
  if (optionsChanged(current, next)) assertContentUnlocked(lockedAt);
};

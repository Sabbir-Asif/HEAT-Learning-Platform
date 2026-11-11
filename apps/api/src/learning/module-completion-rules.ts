import type { LearningModuleState } from "@heat/contracts";

export interface CompletionFacts {
  moduleIds: readonly string[];
  stored: ReadonlyMap<string, LearningModuleState>;
  moduleId: string;
  scoredPassed: boolean;
}

export interface CompletionPlan {
  completeModule: boolean;
  unlockModuleId: string | null;
  completeCourse: boolean;
}

const noChange: CompletionPlan = {
  completeModule: false,
  unlockModuleId: null,
  completeCourse: false,
};

export const planCompletion = (facts: CompletionFacts): CompletionPlan => {
  if (!facts.scoredPassed) return noChange;
  const index = facts.moduleIds.indexOf(facts.moduleId);
  if (index === -1) return noChange;
  const isLast = index === facts.moduleIds.length - 1;
  const nextId = facts.moduleIds[index + 1];
  const nextStatus = nextId === undefined ? undefined : facts.stored.get(nextId);
  const othersCompleted = facts.moduleIds.every(
    (id) => id === facts.moduleId || facts.stored.get(id) === "COMPLETED",
  );
  return {
    completeModule: facts.stored.get(facts.moduleId) !== "COMPLETED",
    unlockModuleId:
      nextId !== undefined && (nextStatus === undefined || nextStatus === "LOCKED") ? nextId : null,
    completeCourse: isLast && othersCompleted,
  };
};

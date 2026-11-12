import type { LearningModuleState } from "@heat/contracts";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { effectiveModuleStates } from "../../src/learning/learning-rules";
import { planCompletion } from "../../src/learning/module-completion-rules";
import { propertyRuns } from "./runs";

const rank: Record<LearningModuleState, number> = {
  LOCKED: 0,
  UNLOCKED: 1,
  IN_PROGRESS: 2,
  QUIZ_READY: 3,
  COMPLETED: 4,
};

const stateArb = fc.constantFrom<LearningModuleState>(
  "LOCKED",
  "UNLOCKED",
  "IN_PROGRESS",
  "QUIZ_READY",
  "COMPLETED",
);

const modulesArb = fc.integer({ min: 1, max: 8 }).chain((count) =>
  fc.record({
    stored: fc.array(fc.option(stateArb, { nil: null }), { minLength: count, maxLength: count }),
    watched: fc.array(fc.boolean(), { minLength: count, maxLength: count }),
  }),
);

const idsOf = (count: number): string[] => Array.from({ length: count }, (_, i) => `m${i}`);

describe("unlock properties", () => {
  test("a module after the first is never open unless the one before is completed", () => {
    fc.assert(
      fc.property(modulesArb, ({ stored, watched }) => {
        const states = effectiveModuleStates("APPROVED", stored, watched);
        expect(states).toHaveLength(stored.length);
        states.forEach((state, index) => {
          if (index > 0 && state !== "LOCKED") expect(states[index - 1]).toBe("COMPLETED");
        });
      }),
      propertyRuns,
    );
  });

  test("a completed enrollment shows every module completed", () => {
    fc.assert(
      fc.property(modulesArb, ({ stored, watched }) => {
        const states = effectiveModuleStates("COMPLETED", stored, watched);
        expect(states.every((state) => state === "COMPLETED")).toBe(true);
      }),
      propertyRuns,
    );
  });

  test("passing a quiz only moves stored states forward and keeps the unlock order", () => {
    fc.assert(
      fc.property(modulesArb, fc.nat(), ({ stored }, pick) => {
        const ids = idsOf(stored.length);
        const target = pick % ids.length;
        const before = new Map<string, LearningModuleState>();
        stored.forEach((state, index) => {
          if (state !== null) before.set(ids[index] as string, state);
        });
        const plan = planCompletion({
          moduleIds: ids,
          stored: before,
          moduleId: ids[target] as string,
          scoredPassed: true,
        });
        const after = new Map(before);
        if (plan.completeModule) after.set(ids[target] as string, "COMPLETED");
        if (plan.unlockModuleId !== null) after.set(plan.unlockModuleId, "UNLOCKED");
        for (const [id, state] of before) {
          expect(rank[after.get(id) ?? "LOCKED"]).toBeGreaterThanOrEqual(rank[state]);
        }
        if (plan.unlockModuleId !== null) {
          expect(plan.unlockModuleId).toBe(ids[target + 1]);
          expect(before.get(plan.unlockModuleId) ?? "LOCKED").toBe("LOCKED");
        }
      }),
      propertyRuns,
    );
  });

  test("a failed attempt or an unknown module changes nothing", () => {
    fc.assert(
      fc.property(modulesArb, fc.nat(), fc.boolean(), ({ stored }, pick, unknown) => {
        const ids = idsOf(stored.length);
        const map = new Map<string, LearningModuleState>();
        stored.forEach((state, index) => {
          if (state !== null) map.set(ids[index] as string, state);
        });
        const plan = planCompletion({
          moduleIds: ids,
          stored: map,
          moduleId: unknown ? "missing" : (ids[pick % ids.length] as string),
          scoredPassed: unknown,
        });
        expect(plan).toEqual({
          completeModule: false,
          unlockModuleId: null,
          completeCourse: false,
        });
      }),
      propertyRuns,
    );
  });

  test("passing the last module yields exactly one course completion however often it repeats", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 1, max: 5 }),
        (count, repeats) => {
          const ids = idsOf(count);
          const stored = new Map<string, LearningModuleState>(
            ids.slice(0, -1).map((id) => [id, "COMPLETED"]),
          );
          stored.set(ids[count - 1] as string, "QUIZ_READY");
          let enrollment: "APPROVED" | "COMPLETED" = "APPROVED";
          let completions = 0;
          for (let attempt = 0; attempt < repeats; attempt += 1) {
            const plan = planCompletion({
              moduleIds: ids,
              stored,
              moduleId: ids[count - 1] as string,
              scoredPassed: true,
            });
            if (plan.completeModule) stored.set(ids[count - 1] as string, "COMPLETED");
            if (plan.completeCourse && enrollment === "APPROVED") {
              enrollment = "COMPLETED";
              completions += 1;
            }
          }
          expect(completions).toBe(1);
        },
      ),
      propertyRuns,
    );
  });

  test("passing a module other than the last never completes the course", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 8 }), fc.nat(), (count, pick) => {
        const ids = idsOf(count);
        const target = pick % (count - 1);
        const stored = new Map<string, LearningModuleState>(
          ids.map((id) => [id, "COMPLETED" as const]),
        );
        const plan = planCompletion({
          moduleIds: ids,
          stored,
          moduleId: ids[target] as string,
          scoredPassed: true,
        });
        expect(plan.completeCourse).toBe(false);
      }),
      propertyRuns,
    );
  });
});

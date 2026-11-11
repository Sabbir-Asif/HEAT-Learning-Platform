import type { LearningModuleState } from "@heat/contracts";
import { describe, expect, test } from "vitest";
import { planCompletion } from "../../src/learning/module-completion-rules";

const ids = ["m1", "m2", "m3"];
const stored = (entries: Record<string, LearningModuleState>) => new Map(Object.entries(entries));

describe("planCompletion", () => {
  test("changes nothing for a failed attempt", () => {
    expect(
      planCompletion({
        moduleIds: ids,
        stored: stored({ m2: "QUIZ_READY" }),
        moduleId: "m2",
        scoredPassed: false,
      }),
    ).toEqual({ completeModule: false, unlockModuleId: null, completeCourse: false });
  });

  test("completes the module and unlocks the next locked one", () => {
    expect(
      planCompletion({
        moduleIds: ids,
        stored: stored({ m1: "COMPLETED", m2: "QUIZ_READY", m3: "LOCKED" }),
        moduleId: "m2",
        scoredPassed: true,
      }),
    ).toEqual({ completeModule: true, unlockModuleId: "m3", completeCourse: false });
  });

  test("unlocks a next module that has no progress row", () => {
    expect(
      planCompletion({
        moduleIds: ids,
        stored: stored({ m1: "QUIZ_READY" }),
        moduleId: "m1",
        scoredPassed: true,
      }),
    ).toMatchObject({ unlockModuleId: "m2" });
  });

  test("leaves a next module that is already past locked", () => {
    expect(
      planCompletion({
        moduleIds: ids,
        stored: stored({ m1: "QUIZ_READY", m2: "UNLOCKED" }),
        moduleId: "m1",
        scoredPassed: true,
      }).unlockModuleId,
    ).toBeNull();
  });

  test("completes the course on the last module when every other module is completed", () => {
    expect(
      planCompletion({
        moduleIds: ids,
        stored: stored({ m1: "COMPLETED", m2: "COMPLETED", m3: "QUIZ_READY" }),
        moduleId: "m3",
        scoredPassed: true,
      }),
    ).toEqual({ completeModule: true, unlockModuleId: null, completeCourse: true });
  });

  test("does not complete the course when an earlier module is not completed", () => {
    expect(
      planCompletion({
        moduleIds: ids,
        stored: stored({ m1: "COMPLETED", m3: "QUIZ_READY" }),
        moduleId: "m3",
        scoredPassed: true,
      }).completeCourse,
    ).toBe(false);
  });

  test("is idempotent for an already completed module", () => {
    expect(
      planCompletion({
        moduleIds: ids,
        stored: stored({ m1: "COMPLETED", m2: "COMPLETED", m3: "UNLOCKED" }),
        moduleId: "m2",
        scoredPassed: true,
      }),
    ).toEqual({ completeModule: false, unlockModuleId: null, completeCourse: false });
  });

  test("ignores a module that is not in the revision", () => {
    expect(
      planCompletion({ moduleIds: ids, stored: stored({}), moduleId: "x", scoredPassed: true }),
    ).toEqual({ completeModule: false, unlockModuleId: null, completeCourse: false });
  });

  test("a single-module course completes on its only module", () => {
    expect(
      planCompletion({ moduleIds: ["m1"], stored: stored({}), moduleId: "m1", scoredPassed: true }),
    ).toEqual({ completeModule: true, unlockModuleId: null, completeCourse: true });
  });
});

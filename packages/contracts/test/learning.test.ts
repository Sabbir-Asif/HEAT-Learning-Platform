import { describe, expect, test } from "vitest";
import {
  learningModuleStateSchema,
  learningStructureParamsSchema,
  learningStructureResponseSchema,
  videoCompletionThreshold,
} from "../src";

const id = "0198f1a0-0000-7000-8000-0000000000a1";

const content = {
  revision: { id, number: 1 },
  summary: { overallProgressPercent: 0, modulesCompleted: 0, modulesTotal: 1, nextModuleId: id },
  modules: [
    {
      id,
      order: 1,
      title: "Module 1",
      objectives: ["Know the policy"],
      state: "UNLOCKED",
      requiredVideosCompleted: 0,
      requiredVideosTotal: 1,
      lessonSections: [{ id, order: 1, title: "Intro" }],
      videos: [
        {
          id,
          order: 1,
          title: "Welcome",
          required: true,
          durationSeconds: 120,
          status: "NOT_STARTED",
          coveragePercent: 0,
          resumePositionSeconds: 0,
        },
      ],
      quiz: {
        id,
        availability: "UNAVAILABLE",
        questionCount: 5,
        passMarkPercent: 70,
        attemptsUsed: 0,
        attemptsAllowed: null,
        nextAttemptAt: null,
      },
    },
  ],
};

const validResponse = {
  course: { id, slug: "heat", title: "HEAT" },
  enrollment: { status: "APPROVED", reason: null },
  learning: content,
};

describe("learning contracts", () => {
  test("a video completes at 80 percent coverage", () => {
    expect(videoCompletionThreshold).toBe(0.8);
  });

  test("the module states are the five stored progress states", () => {
    expect(learningModuleStateSchema.options).toEqual([
      "LOCKED",
      "UNLOCKED",
      "IN_PROGRESS",
      "QUIZ_READY",
      "COMPLETED",
    ]);
  });

  test("the params need a uuid course id", () => {
    expect(learningStructureParamsSchema.safeParse({ courseId: id }).success).toBe(true);
    expect(learningStructureParamsSchema.safeParse({ courseId: "x" }).success).toBe(false);
  });

  test("a full structure response parses", () => {
    expect(learningStructureResponseSchema.safeParse(validResponse).success).toBe(true);
  });

  test("a non-active enrollment carries its status and reason without content", () => {
    const removed = {
      ...validResponse,
      enrollment: { status: "REMOVED", reason: "Left the university" },
      learning: null,
    };
    expect(learningStructureResponseSchema.safeParse(removed).success).toBe(true);
  });

  test("an unknown enrollment status is rejected", () => {
    const unknown = { ...validResponse, enrollment: { status: "DELETED", reason: null } };
    expect(learningStructureResponseSchema.safeParse(unknown).success).toBe(false);
  });

  test("answer keys are stripped from a response", () => {
    const parsed = learningStructureResponseSchema.parse({
      ...validResponse,
      learning: {
        ...content,
        modules: [
          {
            ...content.modules[0],
            quiz: { ...content.modules[0]?.quiz, isCorrect: true, options: [] },
          },
        ],
      },
    });
    expect(JSON.stringify(parsed)).not.toContain("isCorrect");
  });
});

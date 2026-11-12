import type { LearningContent, LearningStructureResponse } from "@heat/contracts";
import { describe, expect, test } from "vitest";
import {
  enrollmentNotice,
  lessonViewOf,
  moduleActionLabel,
  moduleHref,
  quizSummaryOf,
  videoStatusText,
  moduleStateLabel,
  quizActionOf,
  watchRequirementOf,
} from "../../src/learn/learning-view";

type LearningModule = LearningContent["modules"][number];

const uuid = (n: number) => `0198f1a0-0000-7000-8000-${String(n).padStart(12, "0")}`;

const module_ = (n: number, overrides: Partial<LearningModule> = {}): LearningModule => ({
  id: uuid(n),
  order: n,
  title: `Module ${n}`,
  objectives: [],
  state: "UNLOCKED",
  requiredVideosCompleted: 0,
  requiredVideosTotal: 2,
  lessonSections: [],
  videos: [],
  quiz: {
    id: uuid(100 + n),
    availability: "UNAVAILABLE",
    questionCount: 5,
    passMarkPercent: 70,
    attemptsUsed: 0,
    attemptsAllowed: 3,
    nextAttemptAt: null,
  },
  ...overrides,
});

const response = (
  modules: LearningModule[],
  overrides: Partial<LearningStructureResponse> = {},
): LearningStructureResponse => ({
  course: { id: uuid(1), slug: "heat", title: "HEAT" },
  enrollment: { status: "APPROVED", reason: null },
  learning: {
    revision: { id: uuid(2), number: 1 },
    summary: {
      overallProgressPercent: 0,
      modulesCompleted: 0,
      modulesTotal: modules.length,
      nextModuleId: null,
    },
    modules,
  },
  ...overrides,
});

describe("moduleStateLabel", () => {
  test.each([
    ["LOCKED", "Locked"],
    ["UNLOCKED", "Unlocked"],
    ["IN_PROGRESS", "In progress"],
    ["QUIZ_READY", "Quiz ready"],
    ["COMPLETED", "Completed"],
  ] as const)("%s reads %s", (state, label) => {
    expect(moduleStateLabel[state]).toBe(label);
  });
});

describe("moduleHref", () => {
  test("encodes both segments", () => {
    expect(moduleHref("a b", "m/1")).toBe("/learn/a%20b/m%2F1");
  });
});

describe("watchRequirementOf", () => {
  test("reports the watched share and the remaining required videos", () => {
    expect(watchRequirementOf(module_(1, { requiredVideosCompleted: 1 }))).toEqual({
      completed: 1,
      total: 2,
      remaining: 1,
      percent: 50,
      text: "1 of 2 required videos watched",
    });
  });

  test("uses the singular for one required video and 0 percent without any", () => {
    expect(watchRequirementOf(module_(1, { requiredVideosTotal: 1 })).text).toBe(
      "0 of 1 required video watched",
    );
    expect(watchRequirementOf(module_(1, { requiredVideosTotal: 0 }))).toMatchObject({
      percent: 0,
      remaining: 0,
    });
  });
});

describe("quizActionOf", () => {
  const withQuiz = (
    state: LearningModule["state"],
    quiz: Partial<NonNullable<LearningModule["quiz"]>>,
  ) => module_(1, { state, quiz: { ...module_(1).quiz!, ...quiz } });

  test("a module without a quiz has no action", () => {
    expect(quizActionOf("heat", module_(1, { quiz: null }))).toEqual({ kind: "none" });
  });

  test("a quiz ready module opens the quiz", () => {
    expect(quizActionOf("heat", withQuiz("QUIZ_READY", { availability: "AVAILABLE" }))).toEqual({
      kind: "open",
      href: `/learn/heat/${uuid(1)}/quiz`,
    });
  });

  test.each(["UNLOCKED", "IN_PROGRESS"] as const)(
    "a %s module is disabled with the remaining watch requirement",
    (state) => {
      const action = quizActionOf("heat", withQuiz(state, {}));

      expect(action).toEqual({
        kind: "disabled",
        reason: "Watch the 2 required videos to at least 80% to unlock the quiz.",
      });
    },
  );

  test("the remaining count counts down", () => {
    const action = quizActionOf(
      "heat",
      module_(1, { state: "IN_PROGRESS", requiredVideosCompleted: 1 }),
    );

    expect(action).toEqual({
      kind: "disabled",
      reason: "Watch 1 more required video to at least 80% to unlock the quiz.",
    });
  });

  test("a locked module says to finish the previous one", () => {
    expect(quizActionOf("heat", module_(2, { state: "LOCKED" }))).toEqual({
      kind: "disabled",
      reason: "Finish the previous module to unlock this quiz.",
    });
  });

  test("a waiting quiz shows when the next attempt opens in Dhaka time", () => {
    const action = quizActionOf(
      "heat",
      withQuiz("QUIZ_READY", {
        availability: "WAITING",
        nextAttemptAt: "2026-11-12T10:30:00.000Z",
      }),
    );

    expect(action).toEqual({
      kind: "disabled",
      reason: "You can try again on 12 Nov 2026, 16:30.",
    });
  });

  test("an exhausted quiz says no attempts are left", () => {
    expect(quizActionOf("heat", withQuiz("QUIZ_READY", { availability: "EXHAUSTED" }))).toEqual({
      kind: "disabled",
      reason: "You have used all attempts for this quiz.",
    });
  });

  test("a passed quiz or completed module reports it as done", () => {
    expect(quizActionOf("heat", withQuiz("QUIZ_READY", { availability: "PASSED" }))).toEqual({
      kind: "done",
    });
    expect(quizActionOf("heat", module_(1, { state: "COMPLETED" }))).toEqual({ kind: "done" });
  });
});

describe("enrollmentNotice", () => {
  test.each([
    ["PENDING_VERIFICATION", "Verify your email address to continue."],
    ["PENDING_APPROVAL", "An administrator is reviewing your request."],
    ["REJECTED", "Your request was not approved."],
    ["EXPIRED", "This request expired before the email address was verified."],
    ["REMOVED", "Your access to this course was removed."],
  ] as const)("%s", (status, description) => {
    expect(enrollmentNotice(status, null)).toEqual({ status, description, reason: null });
  });

  test("carries the reason", () => {
    expect(enrollmentNotice("REMOVED", "Left the university").reason).toBe("Left the university");
  });
});

describe("lessonViewOf", () => {
  test("a non active enrollment gives its status and no content", () => {
    const view = lessonViewOf(
      response([], {
        enrollment: { status: "REMOVED", reason: "Left" },
        learning: null,
      }),
      uuid(11),
    );

    expect(view).toEqual({
      kind: "status",
      notice: {
        status: "REMOVED",
        description: "Your access to this course was removed.",
        reason: "Left",
      },
    });
  });

  test("an unknown module is missing", () => {
    expect(lessonViewOf(response([module_(11)]), uuid(99))).toEqual({ kind: "missing" });
  });

  test("a locked module names the module that must be finished first", () => {
    const view = lessonViewOf(
      response([
        module_(11, { title: "Basics", state: "IN_PROGRESS" }),
        module_(12, { state: "LOCKED" }),
      ]),
      uuid(12),
    );

    expect(view).toMatchObject({
      kind: "locked",
      reason: 'Finish "Basics" and pass its quiz to open this module.',
    });
  });

  test("a locked first module still gets a reason", () => {
    expect(lessonViewOf(response([module_(11, { state: "LOCKED" })]), uuid(11))).toMatchObject({
      kind: "locked",
      reason: "This module is not open yet.",
    });
  });

  test("an open module is ready with its position among the modules", () => {
    const modules = [module_(11), module_(12, { state: "LOCKED" })];

    const view = lessonViewOf(response(modules), uuid(11));

    expect(view).toMatchObject({ kind: "ready", module: { id: uuid(11) }, courseSlug: "heat" });
    expect(view.kind === "ready" && view.modules).toEqual(modules);
  });
});

describe("moduleActionLabel", () => {
  test("names the next step for each openable state", () => {
    expect(moduleActionLabel.UNLOCKED).toBe("Start");
    expect(moduleActionLabel.IN_PROGRESS).toBe("Continue");
    expect(moduleActionLabel.QUIZ_READY).toBe("Continue");
    expect(moduleActionLabel.COMPLETED).toBe("Review");
  });
});

describe("videoStatusText", () => {
  const video = (status: LearningModule["videos"][number]["status"], coveragePercent = 0) => ({
    id: uuid(50),
    order: 1,
    title: "Welcome",
    required: true,
    durationSeconds: 60,
    status,
    coveragePercent,
    resumePositionSeconds: 0,
  });

  test.each([
    [video("UNAVAILABLE"), "This video is not available yet."],
    [video("NOT_STARTED"), "Not started"],
    [video("IN_PROGRESS", 40), "40% watched"],
    [video("COMPLETED", 100), "Watched"],
  ])("describes the video", (entry, text) => {
    expect(videoStatusText(entry)).toBe(text);
  });
});

describe("quizSummaryOf", () => {
  test("summarises the quiz for the module list", () => {
    expect(quizSummaryOf("heat", module_(1, { quiz: null }))).toBeNull();
    expect(quizSummaryOf("heat", module_(1, { state: "COMPLETED" }))).toBe("Quiz passed");
    expect(
      quizSummaryOf(
        "heat",
        module_(1, {
          state: "QUIZ_READY",
          quiz: { ...module_(1).quiz!, availability: "AVAILABLE" },
        }),
      ),
    ).toBe("Quiz available");
    expect(quizSummaryOf("heat", module_(1, { state: "UNLOCKED" }))).toBe(
      "Watch the 2 required videos to at least 80% to unlock the quiz.",
    );
  });
});

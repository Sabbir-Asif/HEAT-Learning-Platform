import { describe, expect, test } from "vitest";
import { evaluatePublishChecks } from "../../src/catalog/publish-rules";
import type { PublishModule, PublishQuestion } from "../../src/catalog/publish-rules";

const question = (overrides: Partial<PublishQuestion> = {}): PublishQuestion => ({
  id: "q1",
  order: 1,
  options: [{ isCorrect: true }, { isCorrect: false }],
  ...overrides,
});

const module = (overrides: Partial<PublishModule> = {}): PublishModule => ({
  id: "m1",
  order: 1,
  title: "Consent",
  videos: [{ required: true, status: "READY" }],
  quiz: { questions: [question()] },
  ...overrides,
});

const codes = (modules: PublishModule[]) => evaluatePublishChecks(modules).map((f) => f.code);

describe("evaluatePublishChecks", () => {
  test("passes a module with a ready required video and a valid quiz", () => {
    expect(evaluatePublishChecks([module()])).toEqual([]);
  });

  test("refuses a course with no modules", () => {
    expect(evaluatePublishChecks([])).toEqual([
      {
        code: "COURSE_NO_MODULES",
        moduleId: null,
        questionId: null,
        message: "The course has no modules.",
      },
    ]);
  });

  test("refuses a module with no required video", () => {
    expect(codes([module({ videos: [] })])).toEqual(["MODULE_NO_REQUIRED_VIDEO"]);
    expect(codes([module({ videos: [{ required: false, status: "READY" }] })])).toEqual([
      "MODULE_NO_REQUIRED_VIDEO",
    ]);
  });

  test.each(["PROCESSING", "FAILED", "UPLOADING", "QUEUED", "REJECTED", null])(
    "refuses a required video that is %s and names the module",
    (status) => {
      const failures = evaluatePublishChecks([module({ videos: [{ required: true, status }] })]);

      expect(failures).toEqual([
        {
          code: "MODULE_VIDEO_NOT_READY",
          moduleId: "m1",
          questionId: null,
          message: "Module 1 (Consent) has a required video that is not ready.",
        },
      ]);
    },
  );

  test("ignores an optional video that is not ready", () => {
    const videos = [
      { required: true, status: "READY" },
      { required: false, status: "FAILED" },
    ];

    expect(codes([module({ videos })])).toEqual([]);
  });

  test("reports one failure per module for several unready required videos", () => {
    const videos = [
      { required: true, status: "FAILED" },
      { required: true, status: "PROCESSING" },
    ];

    expect(codes([module({ videos })])).toEqual(["MODULE_VIDEO_NOT_READY"]);
  });

  test("refuses a module without a quiz", () => {
    expect(codes([module({ quiz: null })])).toEqual(["MODULE_NO_QUIZ"]);
  });

  test("refuses a quiz without questions", () => {
    const failures = evaluatePublishChecks([module({ quiz: { questions: [] } })]);

    expect(failures).toEqual([
      {
        code: "MODULE_QUIZ_EMPTY",
        moduleId: "m1",
        questionId: null,
        message: "Module 1 (Consent) has a quiz with no questions.",
      },
    ]);
  });

  test.each([1, 7])("refuses a question with %i options", (count) => {
    const options = Array.from({ length: count }, (_, index) => ({ isCorrect: index === 0 }));
    const failures = evaluatePublishChecks([
      module({ quiz: { questions: [question({ options })] } }),
    ]);

    expect(failures).toEqual([
      {
        code: "QUESTION_OPTION_COUNT",
        moduleId: "m1",
        questionId: "q1",
        message: "Module 1 (Consent), question 1 needs 2 to 6 options.",
      },
    ]);
  });

  test.each([0, 2])("refuses a question with %i correct options", (correct) => {
    const options = Array.from({ length: 4 }, (_, index) => ({ isCorrect: index < correct }));
    const failures = evaluatePublishChecks([
      module({ quiz: { questions: [question({ options })] } }),
    ]);

    expect(failures).toEqual([
      {
        code: "QUESTION_CORRECT_COUNT",
        moduleId: "m1",
        questionId: "q1",
        message: "Module 1 (Consent), question 1 needs exactly one correct option.",
      },
    ]);
  });

  test("accepts two and six options", () => {
    const six = Array.from({ length: 6 }, (_, index) => ({ isCorrect: index === 5 }));

    expect(codes([module({ quiz: { questions: [question({ options: six })] } })])).toEqual([]);
  });

  test("lists every failure across modules, not only the first", () => {
    const failures = evaluatePublishChecks([
      module({ id: "m1", order: 1, videos: [{ required: true, status: "FAILED" }] }),
      module({ id: "m2", order: 2, quiz: null }),
      module({ id: "m3", order: 3, videos: [], quiz: { questions: [] } }),
    ]);

    expect(failures.map((f) => [f.code, f.moduleId])).toEqual([
      ["MODULE_VIDEO_NOT_READY", "m1"],
      ["MODULE_NO_QUIZ", "m2"],
      ["MODULE_NO_REQUIRED_VIDEO", "m3"],
      ["MODULE_QUIZ_EMPTY", "m3"],
    ]);
  });
});

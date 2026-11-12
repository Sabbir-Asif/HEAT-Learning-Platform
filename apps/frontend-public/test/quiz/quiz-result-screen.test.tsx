import { act } from "react";
import { beforeEach, afterEach, describe, expect, test, vi } from "vitest";
import { QuizResultScreen } from "../../src/quiz/quiz-result-screen";
import { makeModule, makeStructure, uuid } from "../learn/fixtures";
import { mount } from "../learn/mount";

const useLearningStructure = vi.fn();
const useQuizResultGet = vi.fn();

vi.mock("@heat/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@heat/api-client")>()),
  useLearningStructure: (...args: unknown[]) => useLearningStructure(...args),
  useQuizResultGet: (...args: unknown[]) => useQuizResultGet(...args),
}));

const structureOf = (modules: ReturnType<typeof makeModule>[]) => ({
  isPending: false,
  isError: false,
  data: makeStructure(modules),
  refetch: vi.fn(),
});

const result = (overrides: object) => ({
  isPending: false,
  isError: false,
  data: {
    attemptId: uuid(900),
    scorePercent: 40,
    passed: false,
    passMarkPercent: 70,
    correctCount: 2,
    totalQuestions: 5,
    submittedAt: "2026-11-12T10:00:00.000Z",
    review: null,
    ...overrides,
  },
});

const quiz = (overrides: object) => ({
  id: uuid(101),
  availability: "AVAILABLE" as const,
  questionCount: 5,
  passMarkPercent: 70,
  attemptsUsed: 1,
  attemptsAllowed: 3,
  nextAttemptAt: null,
  ...overrides,
});

const view = () =>
  mount(<QuizResultScreen courseId={uuid(1)} moduleId={uuid(1)} attemptId={uuid(900)} />);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(new Date("2026-11-12T10:00:00.000Z"));
  useLearningStructure.mockReset();
  useQuizResultGet.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("QuizResultScreen", () => {
  test("a passed attempt shows the score and each explanation", async () => {
    useLearningStructure.mockReturnValue(
      structureOf([makeModule(1, { state: "COMPLETED" }), makeModule(2)]),
    );
    useQuizResultGet.mockReturnValue(
      result({
        scorePercent: 100,
        passed: true,
        correctCount: 1,
        totalQuestions: 1,
        review: [
          {
            questionId: uuid(300),
            text: "Which is right?",
            explanation: "Because it is right.",
            selectedOptionId: uuid(401),
            correctOptionId: uuid(401),
            options: [
              { id: uuid(401), text: "Yes" },
              { id: uuid(402), text: "No" },
            ],
          },
        ],
      }),
    );
    const el = await view();
    expect(el.textContent).toContain("You passed");
    expect(el.textContent).toContain("100%");
    expect(el.textContent).toContain("Because it is right.");
    expect(el.textContent).toContain("Continue to Module 2");
  });

  test("a pass on the last module shows the certificate message", async () => {
    useLearningStructure.mockReturnValue(structureOf([makeModule(1, { state: "COMPLETED" })]));
    useQuizResultGet.mockReturnValue(result({ passed: true, scorePercent: 100, review: [] }));
    const el = await view();
    expect(el.textContent).toContain("Your certificate will be issued");
  });

  test("a failed attempt shows the score and no review", async () => {
    useLearningStructure.mockReturnValue(
      structureOf([makeModule(1, { state: "QUIZ_READY", quiz: quiz({}) })]),
    );
    useQuizResultGet.mockReturnValue(result({}));
    const el = await view();
    expect(el.textContent).toContain("You did not pass");
    expect(el.textContent).toContain("2 attempts left");
    expect(el.textContent).not.toContain("Review your answers");
  });

  test("the retry button stays disabled until the countdown reaches zero", async () => {
    useLearningStructure.mockReturnValue(
      structureOf([
        makeModule(1, {
          state: "QUIZ_READY",
          quiz: quiz({ availability: "WAITING", nextAttemptAt: "2026-11-12T10:10:00.000Z" }),
        }),
      ]),
    );
    useQuizResultGet.mockReturnValue(result({}));
    const el = await view();
    expect(el.querySelector('[data-slot="retry-countdown"]')?.textContent).toBe("10:00");
    expect(el.querySelector("button")?.hasAttribute("disabled")).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(10 * 60 * 1000);
    });
    expect(el.querySelector('[data-slot="retry-countdown"]')).toBeNull();
    expect(el.querySelector('a[href$="/quiz"]')).not.toBeNull();
  });

  test("a used-up attempt limit says an admin can grant another and offers no retry", async () => {
    useLearningStructure.mockReturnValue(
      structureOf([
        makeModule(1, {
          state: "QUIZ_READY",
          quiz: quiz({ availability: "EXHAUSTED", attemptsUsed: 3 }),
        }),
      ]),
    );
    useQuizResultGet.mockReturnValue(result({}));
    const el = await view();
    expect(el.textContent).toContain("An administrator can grant you another attempt");
    expect(el.textContent).not.toContain("Try again");
  });

  test("an attempt that is not found shows an unavailable state", async () => {
    useLearningStructure.mockReturnValue(structureOf([makeModule(1, { state: "QUIZ_READY" })]));
    useQuizResultGet.mockReturnValue({ isPending: false, isError: true, data: undefined });
    const el = await view();
    expect(el.textContent).toContain("This result is not available");
  });
});

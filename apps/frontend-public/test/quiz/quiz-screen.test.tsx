import { ApiError } from "@heat/api-client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { QuizScreen } from "../../src/quiz/quiz-screen";
import { makeModule, makeStructure, uuid } from "../learn/fixtures";
import { mount } from "../learn/mount";

const useLearningStructure = vi.fn();
const useQuizDeliveryGet = vi.fn();
const push = vi.fn();

vi.mock("@heat/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@heat/api-client")>()),
  useLearningStructure: (...args: unknown[]) => useLearningStructure(...args),
  useQuizDeliveryGet: (...args: unknown[]) => useQuizDeliveryGet(...args),
}));

vi.mock("../../src/quiz/use-quiz-submit", () => ({ useQuizSubmit: () => vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const structureOk = (modules = [makeModule(1, { state: "QUIZ_READY" })]) => ({
  isPending: false,
  isError: false,
  data: makeStructure(modules),
  refetch: vi.fn(),
});

const base = {
  attemptsUsed: 0,
  attemptsAllowed: 3,
  quiz: null,
  attempt: null,
  questions: [],
  nextAttemptAt: null,
  bestResult: null,
};

const delivery = (data: object) => ({
  isPending: false,
  isError: false,
  data: { ...base, ...data },
  refetch: vi.fn(),
});

beforeEach(() => {
  useLearningStructure.mockReset();
  useQuizDeliveryGet.mockReset();
  push.mockReset();
  useLearningStructure.mockReturnValue(structureOk());
});

const screenView = () => mount(<QuizScreen courseId={uuid(1)} moduleId={uuid(1)} />);

describe("QuizScreen", () => {
  test("shows the loading state while the structure loads", async () => {
    useLearningStructure.mockReturnValue({ isPending: true, isError: false, data: undefined });
    const view = await screenView();
    expect(view.querySelector('[data-slot="quiz-loading"]')).not.toBeNull();
    expect(useQuizDeliveryGet).not.toHaveBeenCalled();
  });

  test("shows the loading state while the quiz loads", async () => {
    useQuizDeliveryGet.mockReturnValue({ isPending: true, isError: false });
    const view = await screenView();
    expect(view.querySelector('[data-slot="quiz-loading"]')).not.toBeNull();
  });

  test("shows an error with retry when the structure fails", async () => {
    useLearningStructure.mockReturnValue({
      isPending: false,
      isError: true,
      data: undefined,
      refetch: vi.fn(),
    });
    const view = await screenView();
    expect(view.querySelector('[data-slot="error-state"]')).not.toBeNull();
  });

  test("shows an error with retry when the quiz fails", async () => {
    useQuizDeliveryGet.mockReturnValue({
      isPending: false,
      isError: true,
      error: new Error("x"),
      refetch: vi.fn(),
    });
    const view = await screenView();
    expect(view.querySelector('[data-slot="error-state"]')).not.toBeNull();
  });

  test("a refused quiz explains why it is locked", async () => {
    useLearningStructure.mockReturnValue(structureOk([makeModule(1, { state: "UNLOCKED" })]));
    useQuizDeliveryGet.mockReturnValue({
      isPending: false,
      isError: true,
      error: new ApiError({ status: 403, code: "QUIZ_NOT_UNLOCKED" }),
      refetch: vi.fn(),
    });
    const view = await screenView();
    expect(view.textContent).toContain("The quiz is locked");
    expect(view.textContent).toContain("Watch");
  });

  test("an unknown module shows not found and a locked module shows the locked view", async () => {
    useLearningStructure.mockReturnValue(
      structureOk([makeModule(2, { state: "LOCKED" }), makeModule(1)]),
    );
    const locked = await mount(<QuizScreen courseId={uuid(1)} moduleId={uuid(2)} />);
    expect(locked.textContent).toContain("This module is locked");
    const missing = await mount(<QuizScreen courseId={uuid(1)} moduleId={uuid(99)} />);
    expect(missing.textContent).toContain("Module not found");
  });

  test("a module without a quiz says so and does not request one", async () => {
    useLearningStructure.mockReturnValue(structureOk([makeModule(1, { quiz: null })]));
    const view = await screenView();
    expect(view.textContent).toContain("This module has no quiz");
    expect(useQuizDeliveryGet).not.toHaveBeenCalled();
  });

  test("the waiting state shows the next attempt time and no questions", async () => {
    useQuizDeliveryGet.mockReturnValue(
      delivery({ status: "WAITING", nextAttemptAt: "2026-11-12T04:10:00.000Z" }),
    );
    const view = await screenView();
    expect(view.textContent).toContain("You can try again later");
    expect(view.textContent).toContain("12 Nov 2026, 10:10");
    expect(view.querySelector('[role="radio"]')).toBeNull();
  });

  test("the exhausted state shows the limit message and no questions", async () => {
    useQuizDeliveryGet.mockReturnValue(delivery({ status: "EXHAUSTED", attemptsUsed: 3 }));
    const view = await screenView();
    expect(view.textContent).toContain("No attempts left");
    expect(view.querySelector('[role="radio"]')).toBeNull();
  });

  test("a passed quiz shows the best score", async () => {
    useQuizDeliveryGet.mockReturnValue(
      delivery({
        status: "PASSED",
        quiz: { id: uuid(5), passMarkPercent: 70 },
        bestResult: {
          attemptId: uuid(6),
          scorePercent: 90,
          passed: true,
          submittedAt: "2026-11-12T04:10:00.000Z",
        },
      }),
    );
    const view = await screenView();
    expect(view.textContent).toContain("You passed this quiz with 90%");
    expect(view.textContent).toContain("Pass mark 70%");
  });

  test("a passed quiz without a stored result still says passed", async () => {
    useQuizDeliveryGet.mockReturnValue(delivery({ status: "PASSED" }));
    const view = await screenView();
    expect(view.textContent).toContain("Quiz passed");
  });

  test("an available quiz renders the first question with its options", async () => {
    useQuizDeliveryGet.mockReturnValue(
      delivery({
        status: "AVAILABLE",
        quiz: { id: uuid(5), passMarkPercent: 70 },
        attempt: { id: uuid(7), startedAt: "2026-11-12T04:00:00.000Z" },
        questions: [
          {
            id: uuid(8),
            order: 1,
            text: "What now?",
            options: [
              { id: uuid(9), text: "Tell someone" },
              { id: uuid(10), text: "Stay silent" },
            ],
          },
        ],
      }),
    );
    const view = await screenView();
    expect(view.textContent).toContain("What now?");
    expect(view.querySelectorAll('[role="radio"]')).toHaveLength(2);
    expect(useQuizDeliveryGet).toHaveBeenCalledWith(
      uuid(1),
      uuid(1),
      expect.objectContaining({ query: expect.objectContaining({ refetchOnWindowFocus: false }) }),
    );
  });
});

import { act } from "react";
import { describe, expect, test, vi } from "vitest";
import { QuizRunner } from "../../src/quiz/quiz-runner";
import { answerStorageKey } from "../../src/quiz/quiz-answer-store";
import { mount } from "../learn/mount";
import { memoryStorage } from "./memory-storage";

const questions = [1, 2, 3, 4, 5].map((n) => ({
  id: `q${n}`,
  order: n,
  text: `Question text ${n}`,
  options: [
    { id: `q${n}-a`, text: `Option ${n}A` },
    { id: `q${n}-b`, text: `Option ${n}B` },
  ],
}));

const radios = (view: HTMLElement) => [...view.querySelectorAll<HTMLElement>('[role="radio"]')];

const button = (view: HTMLElement, name: string): HTMLButtonElement => {
  const found = [...view.querySelectorAll("button")].find((entry) =>
    entry.textContent?.includes(name),
  );
  if (found === undefined) throw new Error(`no button ${name}`);
  return found;
};

const click = async (element: HTMLElement) => act(async () => element.click());

const toReview = async (view: HTMLElement) => {
  while ([...view.querySelectorAll("button")].some((entry) => entry.textContent === "Next")) {
    await click(button(view, "Next"));
  }
  await click(button(view, "Review answers"));
};

const props = (overrides: Partial<React.ComponentProps<typeof QuizRunner>> = {}) => ({
  attemptId: "att1",
  questions,
  submit: vi.fn().mockResolvedValue({ status: "SUBMITTED", attemptId: "att1" }),
  onSubmitted: vi.fn(),
  storage: memoryStorage(),
  ...overrides,
});

describe("QuizRunner", () => {
  test("shows one question at a time with a progress bar and moves with Next and Previous", async () => {
    const view = await mount(<QuizRunner {...props()} />);
    expect(view.textContent).toContain("Question text 1");
    expect(view.textContent).not.toContain("Question text 2");
    expect(view.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(button(view, "Previous").disabled).toBe(true);
    await click(button(view, "Next"));
    expect(view.textContent).toContain("Question text 2");
    await click(button(view, "Previous"));
    expect(view.textContent).toContain("Question text 1");
  });

  test("answering updates the progress label and saves to storage", async () => {
    const storage = memoryStorage();
    const view = await mount(<QuizRunner {...props({ storage })} />);
    expect(view.textContent).toContain("0 of 5 answered");
    await click(radios(view)[1] as HTMLElement);
    expect(view.textContent).toContain("1 of 5 answered");
    expect(JSON.parse(storage.entries.get(answerStorageKey("att1")) ?? "{}")).toEqual({
      q1: "q1-b",
    });
  });

  test("restores three answers after a reload and resumes at the first gap", async () => {
    const storage = memoryStorage({
      [answerStorageKey("att1")]: JSON.stringify({ q1: "q1-a", q2: "q2-b", q3: "q3-a" }),
    });
    const view = await mount(<QuizRunner {...props({ storage })} />);
    expect(view.textContent).toContain("3 of 5 answered");
    expect(view.textContent).toContain("Question text 4");
    await click(button(view, "Previous"));
    expect(radios(view)[0]?.getAttribute("aria-checked")).toBe("true");
  });

  test("the review lists both unanswered questions with links back to them", async () => {
    const storage = memoryStorage({
      [answerStorageKey("att1")]: JSON.stringify({ q1: "q1-a", q3: "q3-a", q5: "q5-b" }),
    });
    const view = await mount(<QuizRunner {...props({ storage })} />);
    await toReview(view);
    expect(view.textContent).toContain("Review your answers");
    expect(view.textContent).toContain("2 questions are not answered yet.");
    const links = [...view.querySelectorAll("a")];
    expect(links.map((link) => link.textContent)).toEqual([
      "Question 2: Question text 2",
      "Question 4: Question text 4",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["#question-2", "#question-4"]);
    await click(links[1] as HTMLElement);
    expect(view.textContent).toContain("Question text 4");
  });

  test("a complete review says so and a refused submission keeps the saved answers", async () => {
    const all = Object.fromEntries(questions.map((q) => [q.id, `${q.id}-a`]));
    const storage = memoryStorage({ [answerStorageKey("att1")]: JSON.stringify(all) });
    const submit = vi.fn().mockResolvedValue({ status: "CLOSED" });
    const view = await mount(<QuizRunner {...props({ storage, submit })} />);
    expect(view.textContent).toContain("All 5 questions are answered.");
    await click(button(view, "Submit answers"));
    expect(submit).toHaveBeenCalledWith({ attemptId: "att1", answers: all });
    expect(view.querySelector('[role="alert"]')?.textContent).toContain(
      "can no longer be submitted",
    );
    expect(storage.entries.has(answerStorageKey("att1"))).toBe(true);
  });

  test("a waiting refusal shows when the next attempt opens and keeps the answers", async () => {
    const submit = vi
      .fn()
      .mockResolvedValue({ status: "WAITING", nextAttemptAt: "2026-11-12T10:05:00.000Z" });
    const storage = memoryStorage({
      [answerStorageKey("att1")]: JSON.stringify({ q1: "q1-a" }),
    });
    const view = await mount(<QuizRunner {...props({ storage, submit })} />);
    await toReview(view);
    await click(button(view, "Submit answers"));
    expect(view.querySelector('[role="alert"]')?.textContent).toContain("next attempt on");
    expect(storage.entries.has(answerStorageKey("att1"))).toBe(true);
  });

  test("a waiting refusal without a time still asks the learner to wait", async () => {
    const submit = vi.fn().mockResolvedValue({ status: "WAITING", nextAttemptAt: null });
    const view = await mount(<QuizRunner {...props({ submit })} />);
    await toReview(view);
    await click(button(view, "Submit answers"));
    expect(view.querySelector('[role="alert"]')?.textContent).toContain("need to wait");
  });

  test("an exhausted refusal says all attempts are used", async () => {
    const submit = vi.fn().mockResolvedValue({ status: "EXHAUSTED" });
    const view = await mount(<QuizRunner {...props({ submit })} />);
    await toReview(view);
    await click(button(view, "Submit answers"));
    expect(view.querySelector('[role="alert"]')?.textContent).toContain("used all your attempts");
  });

  test("a failed submission asks the learner to try again", async () => {
    const submit = vi.fn().mockResolvedValue({ status: "FAILED" });
    const storage = memoryStorage({
      [answerStorageKey("att1")]: JSON.stringify({ q1: "q1-a" }),
    });
    const view = await mount(<QuizRunner {...props({ storage, submit })} />);
    await toReview(view);
    await click(button(view, "Submit answers"));
    expect(view.querySelector('[role="alert"]')?.textContent).toContain("try again");
  });

  test("a confirmed submit clears the saved answers and hands over the attempt", async () => {
    const all = Object.fromEntries(questions.map((q) => [q.id, `${q.id}-a`]));
    const storage = memoryStorage({ [answerStorageKey("att1")]: JSON.stringify(all) });
    const onSubmitted = vi.fn();
    const view = await mount(<QuizRunner {...props({ storage, onSubmitted })} />);
    await click(button(view, "Submit answers"));
    expect(storage.entries.has(answerStorageKey("att1"))).toBe(false);
    expect(onSubmitted).toHaveBeenCalledWith("att1");
  });
});

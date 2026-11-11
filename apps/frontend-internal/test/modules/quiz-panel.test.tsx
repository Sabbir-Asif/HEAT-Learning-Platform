import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { QuizPanel } from "../../src/modules/quiz-panel";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const courseId = "0198f1a0-0000-7000-8000-0000000000c1";
const moduleId = "0198f1a0-0000-7000-8000-0000000000a1";
const first = "0198f1a0-0000-7000-8000-000000000011";
const second = "0198f1a0-0000-7000-8000-000000000012";

const questionOf = (id: string, order: number, text: string) => ({
  id,
  order,
  type: "SINGLE_CHOICE",
  text,
  explanation: null,
  options: [
    { id: `${id}-1`, order: 1, text: "A", isCorrect: true },
    { id: `${id}-2`, order: 2, text: "B", isCorrect: false },
  ],
});

const quiz = (locked: boolean) => ({
  id: "0198f1a0-0000-7000-8000-000000000001",
  rules: { passMarkPercent: 70, attemptLimit: null, waitMinutes: 10 },
  questions: [questionOf(first, 1, "First question"), questionOf(second, 2, "Second question")],
  locked,
});

const fetchMock = vi.fn<typeof fetch>();
let root: Root | undefined;
let container: HTMLElement | undefined;

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
  }));
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

async function mount(courseLocked = false) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () =>
    root?.render(
      <QueryClientProvider client={client}>
        <QuizPanel courseId={courseId} moduleId={moduleId} courseLocked={courseLocked} />
      </QueryClientProvider>,
    ),
  );
  return container;
}

const buttonLabelled = (view: HTMLElement, label: string) =>
  view.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);

describe("QuizPanel", () => {
  test("shows the rules and the questions in order", async () => {
    fetchMock.mockImplementation(async () => json(quiz(false)));
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("First question"));
    expect(view.querySelector<HTMLInputElement>('input[name="passMarkPercent"]')?.value).toBe("70");
    expect(view.querySelector<HTMLInputElement>('input[name="attemptLimit"]')?.value).toBe("");
    expect(view.querySelector<HTMLInputElement>('input[name="waitMinutes"]')?.value).toBe("10");
    expect(view.textContent).toContain("1. First question");
    expect(view.textContent).toContain("2. Second question");
  });

  test("Move down sends the new order from the keyboard buttons", async () => {
    fetchMock.mockImplementation(async () => json(quiz(false)));
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("First question"));
    await act(async () => buttonLabelled(view, "Move First question down")?.click());
    const call = fetchMock.mock.calls.find((entry) =>
      String(entry[0]).includes("/quiz/questions/reorder"),
    );
    expect(call).toBeDefined();
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      previousIds: [first, second],
      orderedIds: [second, first],
    });
  });

  test("a locked course disables the rules and reordering and shows the lock note", async () => {
    fetchMock.mockImplementation(async () => json(quiz(true)));
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("First question"));
    expect(view.textContent).toContain("This course is locked");
    expect(view.querySelector<HTMLInputElement>('input[name="passMarkPercent"]')?.disabled).toBe(
      true,
    );
    expect(buttonLabelled(view, "Move First question down")?.disabled).toBe(true);
  });

  test("an empty quiz offers to add the first question", async () => {
    fetchMock.mockImplementation(async () => json({ ...quiz(false), questions: [] }));
    const view = await mount();
    await vi.waitFor(() => expect(view.textContent).toContain("No questions yet"));
    expect(view.textContent).toContain("Add question");
  });
});

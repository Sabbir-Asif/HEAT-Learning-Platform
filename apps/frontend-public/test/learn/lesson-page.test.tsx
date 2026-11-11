import { act } from "react";
import { describe, expect, test, vi } from "vitest";
import { LessonPage } from "../../src/learn/lesson-page";
import type { LessonContentState } from "../../src/learn/lesson-page";
import { makeModule, uuid } from "./fixtures";
import { mount } from "./mount";

vi.mock("../../src/learn/video-area", async () => {
  const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
  const { default: VideoSlot } = await import("../../src/learn/video-slot");
  const client = new QueryClient();
  return {
    VideoArea: (props: React.ComponentProps<typeof VideoSlot>) => (
      <QueryClientProvider client={client}>
        <VideoSlot {...props} />
      </QueryClientProvider>
    ),
  };
});

const content = (...bodies: object[]): LessonContentState => ({
  status: "ready",
  content: {
    module: { id: uuid(1), title: "Module 1", objectives: [] },
    sections: bodies.map((body, index) => ({
      id: uuid(300 + index),
      order: index + 1,
      title: `Section ${index + 1}`,
      schemaVersion: 1,
      body: body as Record<string, unknown>,
    })),
  },
});

const paragraphs = (...texts: string[]) => ({
  type: "doc",
  content: texts.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
});

const render = (lesson: LessonContentState, module = makeModule(1)) =>
  mount(
    <LessonPage
      courseSlug="heat"
      courseTitle="HEAT"
      module={module}
      modules={[module, makeModule(2, { state: "LOCKED" })]}
      lesson={lesson}
    />,
  );

describe("LessonPage", () => {
  test("renders the lesson sections as paragraphs under their titles", async () => {
    const view = await render(content(paragraphs("First paragraph")));

    const laptop = view.querySelector('[data-layout="laptop-text"]');
    expect(laptop?.querySelector("h2")?.textContent).toBe("Section 1");
    expect(laptop?.querySelector("p")?.textContent).toBe("First paragraph");
  });

  test("a javascript link is dropped and an unknown node is not rendered", async () => {
    const body = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "click me",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
        { type: "script", content: [{ type: "text", text: "evil" }] },
      ],
    };

    const view = await render(content(body));

    expect(view.querySelector('a[href^="javascript"]')).toBeNull();
    expect(view.querySelector('[data-layout="laptop-text"] a')).toBeNull();
    expect(view.textContent).toContain("click me");
    expect(view.textContent).not.toContain("evil");
  });

  test("has the video region, the objectives and the module list in the side panel", async () => {
    const view = await render(content(paragraphs("Text")));

    const aside = view.querySelector("aside");
    expect(aside?.textContent).toContain("Learning objectives");
    expect(aside?.textContent).toContain("Objective 1");
    expect(aside?.textContent).toContain("2. Module 2");
    expect(view.querySelector('section[aria-label="Videos"]')?.textContent).toContain("Video 1");
  });

  test("on a phone the Lesson, Objectives and Modules tabs are keyboard operable tabs", async () => {
    const view = await render(content(paragraphs("Text")));

    const tabs = [...view.querySelectorAll('[role="tab"]')];
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Lesson", "Objectives", "Modules"]);
    expect(view.querySelector('[role="tablist"]')).not.toBeNull();
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
    expect(view.querySelector('[role="tabpanel"]')).not.toBeNull();

    await act(async () => {
      (tabs[1] as HTMLElement).click();
    });

    expect(tabs[1]?.getAttribute("aria-selected")).toBe("true");
    expect(view.querySelector('[role="tabpanel"]')?.textContent).toContain("Objective 1");
  });

  test("the video comes before the lesson text and the tabs", async () => {
    const view = await render(content(paragraphs("Text")));

    const video = view.querySelector('section[aria-label="Videos"]');
    const text = view.querySelector('[data-layout="laptop-text"]');
    const tabs = view.querySelector('[data-layout="phone-tabs"]');
    expect(video?.compareDocumentPosition(text as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(video?.compareDocumentPosition(tabs as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  test("a module not yet at the watch requirement has a disabled quiz button with the remaining requirement", async () => {
    const view = await render(
      content(paragraphs("Text")),
      makeModule(1, { state: "IN_PROGRESS", requiredVideosCompleted: 1 }),
    );

    const button = [...view.querySelectorAll("button")].find(
      (candidate) => candidate.textContent === "Take the quiz",
    );
    expect(
      button?.hasAttribute("disabled") || button?.getAttribute("aria-disabled") === "true",
    ).toBe(true);
    expect(view.textContent).toContain(
      "Watch 1 more required video to at least 80% to unlock the quiz.",
    );
  });

  test("a quiz ready module links to the quiz", async () => {
    const view = await render(
      content(paragraphs("Text")),
      makeModule(1, {
        state: "QUIZ_READY",
        quiz: { ...makeModule(1).quiz!, availability: "AVAILABLE" },
      }),
    );

    expect(view.querySelector(`a[href="/learn/heat/${uuid(1)}/quiz"]`)?.textContent).toBe(
      "Take the quiz",
    );
  });

  test("shows skeletons while the lesson loads", async () => {
    const view = await render({ status: "loading" });

    expect(view.textContent).toContain("Loading lesson");
    expect(view.querySelector('[data-slot="skeleton"]')).not.toBeNull();
  });

  test("shows an error state with a retry that calls back", async () => {
    const onRetry = vi.fn();
    const view = await render({ status: "error", onRetry });

    const retry = [...view.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Retry"),
    );
    await act(async () => retry?.click());

    expect(view.querySelector('[role="alert"]')).not.toBeNull();
    expect(onRetry).toHaveBeenCalled();
  });

  test("shows an empty state when the module has no text", async () => {
    const view = await render(content());

    expect(view.textContent).toContain("No lesson text yet");
  });

  test("renders no video region for a module without videos", async () => {
    const view = await render(content(paragraphs("Text")), makeModule(1, { videos: [] }));

    expect(view.querySelector('section[aria-label="Videos"]')).toBeNull();
  });
});

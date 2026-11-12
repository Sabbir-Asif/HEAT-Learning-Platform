import { ApiError } from "@heat/api-client";
import { act } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { LessonScreen } from "../../src/learn/lesson-screen";
import { makeModule, makeStructure, uuid } from "./fixtures";
import { mount } from "./mount";

const useLearningStructure = vi.fn();
const useLessonContentRead = vi.fn();

vi.mock("@heat/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@heat/api-client")>()),
  useLearningStructure: (...args: unknown[]) => useLearningStructure(...args),
  useLessonContentRead: (...args: unknown[]) => useLessonContentRead(...args),
}));

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

const lessonOk = {
  isError: false,
  data: {
    module: { id: uuid(1), title: "Module 1", objectives: [] },
    sections: [
      {
        id: uuid(300),
        order: 1,
        title: "Intro",
        schemaVersion: 1,
        body: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Hello lesson" }] }],
        },
      },
    ],
  },
};

const structureOk = (modules = [makeModule(1), makeModule(2, { state: "LOCKED" })]) => ({
  isPending: false,
  isError: false,
  data: makeStructure(modules),
  refetch: vi.fn(),
});

beforeEach(() => {
  useLearningStructure.mockReset();
  useLessonContentRead.mockReset();
  useLessonContentRead.mockReturnValue(lessonOk);
});

describe("LessonScreen", () => {
  test("reads the lesson for an open module", async () => {
    useLearningStructure.mockReturnValue(structureOk());

    const view = await mount(<LessonScreen courseId={uuid(1)} moduleId={uuid(1)} />);

    expect(useLessonContentRead).toHaveBeenCalledWith(uuid(1), uuid(1), {
      query: { enabled: true },
    });
    expect(view.textContent).toContain("Hello lesson");
  });

  test("a locked module shows the locked message and the lesson is not requested", async () => {
    useLearningStructure.mockReturnValue(structureOk());

    const view = await mount(<LessonScreen courseId={uuid(1)} moduleId={uuid(2)} />);

    expect(useLessonContentRead).toHaveBeenCalledWith(uuid(1), uuid(2), {
      query: { enabled: false },
    });
    expect(view.textContent).toContain("This module is locked");
    expect(view.textContent).toContain("Finish");
    expect(view.textContent).not.toContain("Hello lesson");
  });

  test("an unknown module shows not found and the lesson is not requested", async () => {
    useLearningStructure.mockReturnValue(structureOk());

    const view = await mount(<LessonScreen courseId={uuid(1)} moduleId={uuid(99)} />);

    expect(useLessonContentRead).toHaveBeenCalledWith(uuid(1), uuid(99), {
      query: { enabled: false },
    });
    expect(view.textContent).toContain("Module not found");
  });

  test("a removed enrollment shows its status and reason and the lesson is not requested", async () => {
    useLearningStructure.mockReturnValue({
      ...structureOk(),
      data: makeStructure([], {
        enrollment: { status: "REMOVED", reason: "Left" },
        learning: null,
      }),
    });

    const view = await mount(<LessonScreen courseId={uuid(1)} moduleId={uuid(1)} />);

    expect(view.textContent).toContain("Your access to this course was removed.");
    expect(view.textContent).toContain("Reason: Left");
    expect(useLessonContentRead).toHaveBeenCalledWith(uuid(1), uuid(1), {
      query: { enabled: false },
    });
  });

  test("shows the loading state while the structure loads", async () => {
    useLearningStructure.mockReturnValue({ isPending: true, isError: false, data: undefined });

    const view = await mount(<LessonScreen courseId={uuid(1)} moduleId={uuid(1)} />);

    expect(view.querySelector('[data-slot="learn-loading"]')).not.toBeNull();
  });

  test("shows an error with a retry when the structure fails", async () => {
    const refetch = vi.fn();
    useLearningStructure.mockReturnValue({
      isPending: false,
      isError: true,
      data: undefined,
      refetch,
    });

    const view = await mount(<LessonScreen courseId={uuid(1)} moduleId={uuid(1)} />);
    const retry = [...view.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Retry"),
    );
    await act(async () => retry?.click());

    expect(refetch).toHaveBeenCalled();
  });

  test("shows the lesson skeleton while the lesson loads and an error when it fails", async () => {
    useLearningStructure.mockReturnValue(structureOk());
    useLessonContentRead.mockReturnValue({ isError: false, data: undefined });

    const loading = await mount(<LessonScreen courseId={uuid(1)} moduleId={uuid(1)} />);
    expect(loading.textContent).toContain("Loading lesson");

    const refetch = vi.fn();
    useLessonContentRead.mockReturnValue({ isError: true, error: new Error("x"), refetch });
    const failed = await mount(<LessonScreen courseId={uuid(1)} moduleId={uuid(1)} />);
    expect(failed.textContent).toContain("The lesson could not be loaded");
  });

  test("a MODULE_LOCKED answer from the API shows the locked state", async () => {
    useLearningStructure.mockReturnValue(structureOk());
    useLessonContentRead.mockReturnValue({
      isError: true,
      error: new ApiError({ status: 403, code: "MODULE_LOCKED" }),
      data: undefined,
    });

    const view = await mount(<LessonScreen courseId={uuid(1)} moduleId={uuid(1)} />);

    expect(view.textContent).toContain("This module is locked");
  });
});

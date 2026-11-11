import { act } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { CourseScreen } from "../../src/learn/course-screen";
import { makeModule, makeStructure, uuid } from "./fixtures";
import { mount } from "./mount";

const useLearningStructure = vi.fn();

vi.mock("@heat/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@heat/api-client")>()),
  useLearningStructure: (...args: unknown[]) => useLearningStructure(...args),
}));

beforeEach(() => useLearningStructure.mockReset());

describe("CourseScreen", () => {
  test("renders the course home from the structure", async () => {
    useLearningStructure.mockReturnValue({
      isPending: false,
      isError: false,
      data: makeStructure([makeModule(1)]),
    });

    const view = await mount(<CourseScreen courseId={uuid(1)} />);

    expect(useLearningStructure).toHaveBeenCalledWith(uuid(1));
    expect(view.textContent).toContain("HEAT Gender Safety");
    expect(view.textContent).toContain("1. Module 1");
  });

  test("shows the loading state", async () => {
    useLearningStructure.mockReturnValue({ isPending: true, isError: false });

    const view = await mount(<CourseScreen courseId={uuid(1)} />);

    expect(view.querySelector('[data-slot="learn-loading"]')).not.toBeNull();
  });

  test("shows an error with a retry", async () => {
    const refetch = vi.fn();
    useLearningStructure.mockReturnValue({ isPending: false, isError: true, refetch });

    const view = await mount(<CourseScreen courseId={uuid(1)} />);
    const retry = [...view.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Retry"),
    );
    await act(async () => retry?.click());

    expect(refetch).toHaveBeenCalled();
  });
});

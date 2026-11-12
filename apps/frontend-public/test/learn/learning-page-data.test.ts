import { getLearningStructureQueryKey, getLessonContentReadQueryKey } from "@heat/api-client";
import type { MeResponse } from "@heat/contracts";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { makeModule, makeStructure, uuid } from "./fixtures";

const verifySession = vi.fn();
const learningStructure = vi.fn();
const lessonContentRead = vi.fn();
const redirect = vi.fn((location: string): never => {
  throw new Error(`redirect:${location}`);
});

vi.mock("server-only", () => ({}));
vi.mock("../../src/auth/session", () => ({ verifySession: () => verifySession() }));
vi.mock("@heat/api-client/server", async () => {
  const client = await import("@heat/api-client");
  return {
    learningStructure: (...args: unknown[]) => learningStructure(...args),
    lessonContentRead: (...args: unknown[]) => lessonContentRead(...args),
    getLearningStructureUrl: client.getLearningStructureUrl,
    getLessonContentReadUrl: client.getLessonContentReadUrl,
  };
});
vi.mock("next/navigation", () => ({ redirect: (location: string) => redirect(location) }));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));

const session = (status = "APPROVED"): MeResponse => ({
  user: {
    id: uuid(900),
    email: "a@b.test",
    role: "STUDENT",
    emailVerified: true,
    mustChangePassword: false,
  },
  enrollments: [
    {
      courseId: uuid(1),
      courseSlug: "heat",
      courseTitle: "HEAT",
      status: status as MeResponse["enrollments"][number]["status"],
    },
  ],
  verificationEmail: null,
  verificationEmailSentAt: null,
});

const queryKeys = (state: { queries: { queryKey: readonly unknown[] }[] }) =>
  state.queries.map((query) => query.queryKey);

beforeEach(() => {
  verifySession.mockReset().mockResolvedValue(session());
  learningStructure.mockReset();
  lessonContentRead.mockReset();
  redirect.mockClear();
});

describe("loadLearningPage", () => {
  test("sends a course the student has no enrollment for to the course overview", async () => {
    const { loadLearningPage } = await import("../../src/learn/learning-page-data");

    await expect(loadLearningPage("other")).rejects.toThrow("redirect:/courses/other");
    expect(learningStructure).not.toHaveBeenCalled();
  });

  test("reads the structure by course id and hydrates it under the client query key", async () => {
    const structure = makeStructure([makeModule(1)]);
    learningStructure.mockResolvedValue(structure);
    const { loadLearningPage } = await import("../../src/learn/learning-page-data");

    const page = await loadLearningPage("heat");

    expect(learningStructure).toHaveBeenCalledWith(uuid(1));
    expect(page.courseId).toBe(uuid(1));
    expect(queryKeys(page.state)).toEqual([getLearningStructureQueryKey(uuid(1))]);
    expect(lessonContentRead).not.toHaveBeenCalled();
  });

  test("prefetches the lesson of an open module under the client query key", async () => {
    learningStructure.mockResolvedValue(makeStructure([makeModule(1)]));
    lessonContentRead.mockResolvedValue({ module: {}, sections: [] });
    const { loadLearningPage } = await import("../../src/learn/learning-page-data");

    const page = await loadLearningPage("heat", uuid(1));

    expect(lessonContentRead).toHaveBeenCalledWith(uuid(1), uuid(1));
    expect(queryKeys(page.state)).toContainEqual(getLessonContentReadQueryKey(uuid(1), uuid(1)));
  });

  test("does not ask the API for the lesson of a locked module", async () => {
    learningStructure.mockResolvedValue(
      makeStructure([makeModule(1), makeModule(2, { state: "LOCKED" })]),
    );
    const { loadLearningPage } = await import("../../src/learn/learning-page-data");

    await loadLearningPage("heat", uuid(2));

    expect(lessonContentRead).not.toHaveBeenCalled();
  });

  test("does not ask the API for the lesson of a removed enrollment", async () => {
    learningStructure.mockResolvedValue(
      makeStructure([], { enrollment: { status: "REMOVED", reason: null }, learning: null }),
    );
    const { loadLearningPage } = await import("../../src/learn/learning-page-data");

    await loadLearningPage("heat", uuid(1));

    expect(lessonContentRead).not.toHaveBeenCalled();
  });

  test("a failed lesson prefetch leaves the page to retry in the browser", async () => {
    learningStructure.mockResolvedValue(makeStructure([makeModule(1)]));
    lessonContentRead.mockRejectedValue(new Error("boom"));
    const { loadLearningPage } = await import("../../src/learn/learning-page-data");

    const page = await loadLearningPage("heat", uuid(1));

    expect(queryKeys(page.state)).toEqual([getLearningStructureQueryKey(uuid(1))]);
  });
});

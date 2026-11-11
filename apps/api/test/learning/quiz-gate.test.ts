import { NotFoundException } from "@nestjs/common";
import { describe, expect, test, vi } from "vitest";
import { QuizGateService } from "../../src/learning/quiz-gate";

const ids = {
  rev: "rev1",
  m1: "m1",
  m2: "m2",
  v1: "v1",
  v2: "v2",
  v3: "v3",
};

interface Options {
  enrollmentStatus?: string;
  enrollment?: object | null;
  moduleStatus?: string | null;
  videos?: { id: string; required: boolean }[];
  videoProgress?: object[];
}

const build = (options: Options = {}) => {
  const database = {
    enrollment: {
      findFirst: vi.fn().mockResolvedValue(
        options.enrollment === undefined
          ? {
              id: "e1",
              status: options.enrollmentStatus ?? "APPROVED",
              courseRevisionId: ids.rev,
              course: { deletedAt: null },
              courseRevision: { id: ids.rev, number: 1, deletedAt: null },
            }
          : options.enrollment,
      ),
    },
    module: {
      findMany: vi.fn().mockResolvedValue([
        { id: ids.m1, videos: options.videos ?? [{ id: ids.v1, required: true }] },
        { id: ids.m2, videos: [] },
      ]),
    },
    moduleProgress: {
      findMany: vi
        .fn()
        .mockResolvedValue(
          options.moduleStatus === null
            ? []
            : [{ moduleId: ids.m1, status: options.moduleStatus ?? "IN_PROGRESS" }],
        ),
    },
    videoProgress: { findMany: vi.fn().mockResolvedValue(options.videoProgress ?? []) },
  };
  return { service: new QuizGateService(database as never), database };
};

const watched = (videoId: string, coverage: number) => ({
  videoId,
  coverage,
  completedAt: null,
});

describe("QuizGateService.requireUnlocked", () => {
  test("refuses with 403 and a stable code when the only required video is at 79 percent", async () => {
    const { service } = build({ videoProgress: [watched(ids.v1, 0.79)] });
    await expect(service.requireUnlocked("u1", "c1", ids.m1)).rejects.toMatchObject({
      status: 403,
      code: "QUIZ_NOT_UNLOCKED",
    });
  });

  test("allows the quiz at 80 percent even before the stored state catches up", async () => {
    const { service } = build({ videoProgress: [watched(ids.v1, 0.8)] });
    await expect(service.requireUnlocked("u1", "c1", ids.m1)).resolves.toBe("QUIZ_READY");
  });

  test("refuses when one of two required videos is at 50 percent", async () => {
    const { service } = build({
      videos: [
        { id: ids.v1, required: true },
        { id: ids.v2, required: true },
      ],
      videoProgress: [watched(ids.v1, 1), watched(ids.v2, 0.5)],
    });
    await expect(service.requireUnlocked("u1", "c1", ids.m1)).rejects.toMatchObject({
      code: "QUIZ_NOT_UNLOCKED",
    });
  });

  test("an optional video with no progress does not block", async () => {
    const { service } = build({
      videos: [
        { id: ids.v1, required: true },
        { id: ids.v3, required: false },
      ],
      videoProgress: [watched(ids.v1, 0.9)],
    });
    await expect(service.requireUnlocked("u1", "c1", ids.m1)).resolves.toBe("QUIZ_READY");
  });

  test("a direct call without any watching is refused", async () => {
    const { service } = build({ moduleStatus: null });
    await expect(service.requireUnlocked("u1", "c1", ids.m1)).rejects.toMatchObject({
      code: "QUIZ_NOT_UNLOCKED",
    });
  });

  test("a locked later module is refused", async () => {
    const { service } = build({ moduleStatus: "IN_PROGRESS" });
    await expect(service.requireUnlocked("u1", "c1", ids.m2)).rejects.toMatchObject({
      code: "QUIZ_NOT_UNLOCKED",
    });
  });

  test("a stored quiz ready or completed module passes", async () => {
    for (const moduleStatus of ["QUIZ_READY", "COMPLETED"]) {
      const { service } = build({ moduleStatus });
      await expect(service.requireUnlocked("u1", "c1", ids.m1)).resolves.toBe(moduleStatus);
    }
  });

  test("a completed enrollment may rewatch and retake", async () => {
    const { service } = build({ enrollmentStatus: "COMPLETED" });
    await expect(service.requireUnlocked("u1", "c1", ids.m1)).resolves.toBe("COMPLETED");
  });

  test("refuses without an active enrollment", async () => {
    const { service } = build({ enrollment: null });
    await expect(service.requireUnlocked("u1", "c1", ids.m1)).rejects.toMatchObject({
      status: 403,
      code: "ENROLLMENT_NOT_ACTIVE",
    });
  });

  test("an unknown module is not found", async () => {
    const { service } = build();
    await expect(service.requireUnlocked("u1", "c1", "other")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

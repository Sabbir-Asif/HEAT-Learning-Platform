import { NotFoundException } from "@nestjs/common";
import { describe, expect, test, vi } from "vitest";
import { ApiException } from "../../src/http/api-exception";
import { LearningStructureService } from "../../src/learning/learning-structure.service";

const now = new Date("2026-11-12T10:00:00.000Z");
const ids = {
  course: "0198f1a0-0000-7000-8000-000000000001",
  revision: "0198f1a0-0000-7000-8000-000000000002",
  m1: "0198f1a0-0000-7000-8000-000000000011",
  m2: "0198f1a0-0000-7000-8000-000000000012",
  v1: "0198f1a0-0000-7000-8000-000000000021",
  v2: "0198f1a0-0000-7000-8000-000000000022",
  s1: "0198f1a0-0000-7000-8000-000000000031",
  q1: "0198f1a0-0000-7000-8000-000000000041",
};

interface Options {
  enrollment?: object | null;
  progress?: object[];
  videoProgress?: object[];
  attempts?: object[];
  grants?: object[];
  modules?: object[];
}

const enrollmentRow = (overrides: object = {}) => ({
  id: "e1",
  status: "APPROVED",
  courseRevisionId: ids.revision,
  course: { id: ids.course, slug: "heat", title: "HEAT", deletedAt: null },
  courseRevision: { id: ids.revision, number: 3, deletedAt: null },
  ...overrides,
});

const moduleRows = () => [
  {
    id: ids.m1,
    order: 1,
    title: "Module 1",
    objectives: ["Know the policy"],
    lessonSections: [{ id: ids.s1, order: 1, title: "Intro" }],
    videos: [
      {
        id: ids.v1,
        order: 1,
        title: "Welcome",
        required: true,
        asset: { status: "READY", durationSeconds: 120 },
      },
      {
        id: ids.v2,
        order: 2,
        title: "Extra",
        required: false,
        asset: null,
      },
    ],
    quiz: {
      id: ids.q1,
      passMarkPercent: 70,
      attemptLimit: 3,
      waitMinutes: 10,
      deletedAt: null,
      _count: { questions: 5 },
    },
  },
  {
    id: ids.m2,
    order: 2,
    title: "Module 2",
    objectives: [],
    lessonSections: [],
    videos: [],
    quiz: null,
  },
];

const build = (options: Options = {}) => {
  const database = {
    enrollment: {
      findFirst: vi
        .fn()
        .mockResolvedValue(options.enrollment === undefined ? enrollmentRow() : options.enrollment),
    },
    module: { findMany: vi.fn().mockResolvedValue(options.modules ?? moduleRows()) },
    moduleProgress: {
      findMany: vi
        .fn()
        .mockResolvedValue(options.progress ?? [{ moduleId: ids.m1, status: "UNLOCKED" }]),
    },
    videoProgress: { findMany: vi.fn().mockResolvedValue(options.videoProgress ?? []) },
    quizAttempt: { findMany: vi.fn().mockResolvedValue(options.attempts ?? []) },
    attemptGrant: { findMany: vi.fn().mockResolvedValue(options.grants ?? []) },
  };
  const service = new LearningStructureService(database as never, { now: () => now });
  return { service, database };
};

describe("LearningStructureService.describe", () => {
  test("a student who has not started sees module 1 unlocked and module 2 locked", async () => {
    const { service } = build();

    const result = await service.describe("u1", ids.course);

    expect(result.modules.map((entry) => entry.state)).toEqual(["UNLOCKED", "LOCKED"]);
    expect(result.summary).toEqual({
      overallProgressPercent: 0,
      modulesCompleted: 0,
      modulesTotal: 2,
      nextModuleId: ids.m1,
    });
    expect(result.enrollment).toEqual({ status: "APPROVED" });
    expect(result.course).toEqual({ id: ids.course, slug: "heat", title: "HEAT" });
  });

  test("reads the structure from the pinned revision, not the latest", async () => {
    const { service, database } = build();

    const result = await service.describe("u1", ids.course);

    expect(database.module.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { revisionId: ids.revision, deletedAt: null } }),
    );
    expect(result.revision).toEqual({ id: ids.revision, number: 3 });
  });

  test("scopes the enrollment lookup to the calling user", async () => {
    const { service, database } = build();

    await service.describe("u1", ids.course);

    expect(database.enrollment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1", courseId: ids.course, deletedAt: null },
      }),
    );
    expect(database.moduleProgress.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ enrollmentId: "e1" }) }),
    );
    expect(database.videoProgress.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ enrollmentId: "e1" }) }),
    );
    expect(database.quizAttempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ enrollmentId: "e1" }) }),
    );
  });

  test.each(["PENDING_VERIFICATION", "PENDING_APPROVAL", "REJECTED", "EXPIRED", "REMOVED"])(
    "refuses a %s enrollment with 403 before looking at the revision",
    async (status) => {
      const { service, database } = build({
        enrollment: enrollmentRow({ status, courseRevisionId: null, courseRevision: null }),
      });

      await expect(service.describe("u1", ids.course)).rejects.toMatchObject({
        code: "ENROLLMENT_NOT_ACTIVE",
      });
      await expect(service.describe("u1", ids.course)).rejects.toBeInstanceOf(ApiException);
      expect(database.module.findMany).not.toHaveBeenCalled();
    },
  );

  test("refuses a missing enrollment with 403", async () => {
    const { service } = build({ enrollment: null });

    await expect(service.describe("u1", ids.course)).rejects.toMatchObject({
      code: "ENROLLMENT_NOT_ACTIVE",
    });
  });

  test("an active enrollment without a pinned revision is not found", async () => {
    const { service } = build({
      enrollment: enrollmentRow({ courseRevisionId: null, courseRevision: null }),
    });

    await expect(service.describe("u1", ids.course)).rejects.toBeInstanceOf(NotFoundException);
  });

  test("a deleted course or revision is not found", async () => {
    const deletedCourse = build({
      enrollment: enrollmentRow({ course: { ...enrollmentRow().course, deletedAt: now } }),
    });
    const deletedRevision = build({
      enrollment: enrollmentRow({
        courseRevision: { id: ids.revision, number: 3, deletedAt: now },
      }),
    });

    await expect(deletedCourse.service.describe("u1", ids.course)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(deletedRevision.service.describe("u1", ids.course)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  test("a completed enrollment sees every module completed", async () => {
    const { service } = build({ enrollment: enrollmentRow({ status: "COMPLETED" }), progress: [] });

    const result = await service.describe("u1", ids.course);

    expect(result.modules.map((entry) => entry.state)).toEqual(["COMPLETED", "COMPLETED"]);
    expect(result.summary).toMatchObject({ overallProgressPercent: 100, nextModuleId: null });
    expect(result.modules[0]?.quiz?.availability).toBe("PASSED");
  });

  test("maps lesson sections, objectives and videos with status and coverage", async () => {
    const { service } = build({
      videoProgress: [
        { videoId: ids.v1, coverage: 0.5, resumePositionSeconds: 30, completedAt: null },
      ],
    });

    const [first] = (await service.describe("u1", ids.course)).modules;

    expect(first?.objectives).toEqual(["Know the policy"]);
    expect(first?.lessonSections).toEqual([{ id: ids.s1, order: 1, title: "Intro" }]);
    expect(first?.videos).toEqual([
      {
        id: ids.v1,
        order: 1,
        title: "Welcome",
        required: true,
        durationSeconds: 120,
        status: "IN_PROGRESS",
        coveragePercent: 50,
        resumePositionSeconds: 30,
      },
      {
        id: ids.v2,
        order: 2,
        title: "Extra",
        required: false,
        durationSeconds: null,
        status: "UNAVAILABLE",
        coveragePercent: 0,
        resumePositionSeconds: 0,
      },
    ]);
    expect(first).toMatchObject({ requiredVideosCompleted: 0, requiredVideosTotal: 1 });
  });

  test("clamps coverage to 0 to 100 percent", async () => {
    const { service } = build({
      videoProgress: [
        { videoId: ids.v1, coverage: 1.7, resumePositionSeconds: 0, completedAt: null },
      ],
    });

    const [first] = (await service.describe("u1", ids.course)).modules;

    expect(first?.videos[0]).toMatchObject({ coveragePercent: 100, status: "COMPLETED" });
  });

  test("describes the quiz with attempts, allowance and next attempt time", async () => {
    const { service } = build({
      progress: [{ moduleId: ids.m1, status: "QUIZ_READY" }],
      attempts: [
        {
          quizId: ids.q1,
          passed: false,
          submittedAt: new Date("2026-11-12T09:55:00.000Z"),
        },
      ],
      grants: [{ quizId: ids.q1, extraAttempts: 2 }],
    });

    const [first] = (await service.describe("u1", ids.course)).modules;

    expect(first?.quiz).toEqual({
      id: ids.q1,
      availability: "WAITING",
      questionCount: 5,
      passMarkPercent: 70,
      attemptsUsed: 1,
      attemptsAllowed: 5,
      nextAttemptAt: "2026-11-12T10:05:00.000Z",
    });
  });

  test("a soft-deleted quiz is not exposed", async () => {
    const rows = moduleRows();
    const first = rows[0] as { quiz: { deletedAt: Date } };
    first.quiz.deletedAt = now;
    const { service } = build({ modules: rows });

    expect((await service.describe("u1", ids.course)).modules[0]?.quiz).toBeNull();
  });

  test("the response carries no answer keys, disk paths or other students' data", async () => {
    const { service } = build({
      progress: [{ moduleId: ids.m1, status: "QUIZ_READY" }],
    });

    const text = JSON.stringify(await service.describe("u1", ids.course));

    for (const forbidden of ["isCorrect", "options", "explanation", "assetKey", "path", "userId"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  test("a course without modules has no next module", async () => {
    const { service } = build({ modules: [], progress: [] });

    const result = await service.describe("u1", ids.course);

    expect(result.modules).toEqual([]);
    expect(result.summary).toEqual({
      overallProgressPercent: 0,
      modulesCompleted: 0,
      modulesTotal: 0,
      nextModuleId: null,
    });
  });
});

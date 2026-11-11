import { describe, expect, test, vi } from "vitest";
import { DashboardService } from "../../src/learning/dashboard.service";

const id = (n: number) => `0198f1a0-0000-7000-8000-0000000000${String(n).padStart(2, "0")}`;
const at = (minute: number) => new Date(Date.UTC(2026, 10, 12, 10, minute));

const course = (n: number) => ({ id: id(n), slug: `course-${n}`, title: `Course ${n}` });

const enrollmentRow = (overrides: object = {}) => ({
  id: "e1",
  status: "APPROVED",
  courseRevisionId: id(50),
  course: course(1),
  certificate: null,
  decisions: [],
  ...overrides,
});

const modules = [
  {
    id: id(11),
    revisionId: id(50),
    order: 1,
    title: "Module 1",
    videos: [{ id: id(21), required: true }],
  },
  {
    id: id(12),
    revisionId: id(50),
    order: 2,
    title: "Module 2",
    videos: [
      { id: id(22), required: true },
      { id: id(23), required: false },
    ],
  },
  { id: id(13), revisionId: id(50), order: 3, title: "Module 3", videos: [] },
];

interface Options {
  enrollments?: object[];
  moduleProgress?: object[];
  videoProgress?: object[];
}

const build = (options: Options = {}) => {
  const database = {
    enrollment: { findMany: vi.fn().mockResolvedValue(options.enrollments ?? [enrollmentRow()]) },
    module: { findMany: vi.fn().mockResolvedValue(modules) },
    moduleProgress: { findMany: vi.fn().mockResolvedValue(options.moduleProgress ?? []) },
    videoProgress: { findMany: vi.fn().mockResolvedValue(options.videoProgress ?? []) },
  };
  return { service: new DashboardService(database as never), database };
};

describe("DashboardService.describe", () => {
  test("lists only the caller's live enrollments", async () => {
    const { service, database } = build();

    await service.describe("u1");

    expect(database.enrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1", deletedAt: null, course: { deletedAt: null } },
      }),
    );
  });

  test("an approved student with module 2 in progress continues module 2 at the resume point", async () => {
    const { service } = build({
      moduleProgress: [
        { enrollmentId: "e1", moduleId: id(11), status: "COMPLETED" },
        { enrollmentId: "e1", moduleId: id(12), status: "IN_PROGRESS" },
      ],
      videoProgress: [
        {
          enrollmentId: "e1",
          videoId: id(21),
          coverage: 1,
          resumePositionSeconds: 90,
          completedAt: at(1),
          updatedAt: at(1),
        },
        {
          enrollmentId: "e1",
          videoId: id(22),
          coverage: 0.3,
          resumePositionSeconds: 45,
          completedAt: null,
          updatedAt: at(4),
        },
      ],
    });

    const { courses } = await service.describe("u1");

    expect(courses).toEqual([
      {
        courseId: id(1),
        courseSlug: "course-1",
        courseTitle: "Course 1",
        status: "APPROVED",
        reason: null,
        progress: { modulesCompleted: 1, modulesTotal: 3, percent: 33 },
        nextModule: {
          id: id(12),
          order: 2,
          title: "Module 2",
          resumeVideoId: id(22),
          resumePositionSeconds: 45,
        },
        certificateNumber: null,
      },
    ]);
  });

  test("a new student continues module 1 from the start", async () => {
    const { service } = build();

    const { courses } = await service.describe("u1");

    expect(courses[0]?.nextModule).toEqual({
      id: id(11),
      order: 1,
      title: "Module 1",
      resumeVideoId: null,
      resumePositionSeconds: 0,
    });
    expect(courses[0]?.progress).toEqual({ modulesCompleted: 0, modulesTotal: 3, percent: 0 });
  });

  test("a completed course is fully complete, has no next module and carries its certificate", async () => {
    const { service } = build({
      enrollments: [
        enrollmentRow({
          status: "COMPLETED",
          certificate: { number: "ABC123", revokedAt: null },
        }),
      ],
    });

    const { courses } = await service.describe("u1");

    expect(courses[0]).toMatchObject({
      status: "COMPLETED",
      progress: { modulesCompleted: 3, modulesTotal: 3, percent: 100 },
      nextModule: null,
      certificateNumber: "ABC123",
    });
  });

  test("a revoked certificate gives no link", async () => {
    const { service } = build({
      enrollments: [
        enrollmentRow({ status: "COMPLETED", certificate: { number: "X", revokedAt: at(1) } }),
      ],
    });

    expect((await service.describe("u1")).courses[0]?.certificateNumber).toBeNull();
  });

  test("a pending course has its status only and triggers no content query", async () => {
    const { service, database } = build({
      enrollments: [enrollmentRow({ status: "PENDING_APPROVAL", courseRevisionId: null })],
    });

    const { courses } = await service.describe("u1");

    expect(courses[0]).toMatchObject({
      status: "PENDING_APPROVAL",
      progress: null,
      nextModule: null,
    });
    expect(database.module.findMany).not.toHaveBeenCalled();
    expect(database.moduleProgress.findMany).not.toHaveBeenCalled();
  });

  test("a removed course shows the latest reason and no continue target", async () => {
    const { service } = build({
      enrollments: [
        enrollmentRow({ status: "REMOVED", decisions: [{ reason: "Left the university" }] }),
      ],
    });

    const { courses } = await service.describe("u1");

    expect(courses[0]).toMatchObject({
      status: "REMOVED",
      reason: "Left the university",
      progress: null,
      nextModule: null,
    });
  });

  test("an approved reason is never exposed", async () => {
    const { service } = build({
      enrollments: [enrollmentRow({ decisions: [{ reason: "internal note" }] })],
    });

    expect((await service.describe("u1")).courses[0]?.reason).toBeNull();
  });

  test("reads every table once for all enrollments", async () => {
    const { service, database } = build({
      enrollments: [
        enrollmentRow(),
        enrollmentRow({ id: "e2", status: "COMPLETED", course: course(2) }),
      ],
    });

    await service.describe("u1");

    expect(database.enrollment.findMany).toHaveBeenCalledTimes(1);
    expect(database.module.findMany).toHaveBeenCalledTimes(1);
    expect(database.moduleProgress.findMany).toHaveBeenCalledTimes(1);
    expect(database.videoProgress.findMany).toHaveBeenCalledTimes(1);
    expect(database.moduleProgress.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { enrollmentId: { in: ["e1", "e2"] } } }),
    );
  });
});

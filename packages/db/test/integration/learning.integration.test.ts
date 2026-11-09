import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { withDatabase, type TestDatabase } from "./helpers";

let database: TestDatabase;

beforeAll(async () => {
  database = await withDatabase();
});

afterAll(async () => {
  await database.close();
});

const unique = () => Math.random().toString(36).slice(2);

const createLearner = async () => {
  const student = await database.prisma.user.create({
    data: {
      email: `${unique()}@example.com`,
      passwordHash: "argon2id-hash",
      role: "STUDENT",
      realm: "STUDENT",
    },
  });
  const course = await database.prisma.course.create({
    data: { slug: `course-${unique()}`, title: "Gender safety" },
  });
  const revision = await database.prisma.courseRevision.create({
    data: { courseId: course.id, number: 1 },
  });
  const module = await database.prisma.module.create({
    data: { revisionId: revision.id, order: 1, title: "Module one" },
  });
  const asset = await database.prisma.videoAsset.create({
    data: { assetKey: `asset-${unique()}` },
  });
  const video = await database.prisma.video.create({
    data: { moduleId: module.id, order: 1, title: "Intro", assetId: asset.id },
  });
  const enrollment = await database.prisma.enrollment.create({
    data: {
      userId: student.id,
      courseId: course.id,
      courseRevisionId: revision.id,
      status: "APPROVED",
    },
  });
  return { student, course, revision, module, video, enrollment };
};

describe("playback sessions", () => {
  test("a session records when it started", async () => {
    const { enrollment, video } = await createLearner();

    const session = await database.prisma.playbackSession.create({
      data: { enrollmentId: enrollment.id, videoId: video.id },
    });

    expect(session.startedAt).toBeInstanceOf(Date);
    expect(session.endedAt).toBeNull();
  });

  test("one enrollment can open many sessions for the same video", async () => {
    const { enrollment, video } = await createLearner();
    const data = { enrollmentId: enrollment.id, videoId: video.id };
    await database.prisma.playbackSession.create({ data });

    await database.prisma.playbackSession.create({ data });

    expect(
      await database.prisma.playbackSession.count({ where: { enrollmentId: enrollment.id } }),
    ).toBe(2);
  });
});

describe("video progress", () => {
  test("a new row starts empty at the beginning of the video", async () => {
    const { enrollment, video } = await createLearner();

    const progress = await database.prisma.videoProgress.create({
      data: { enrollmentId: enrollment.id, videoId: video.id },
    });

    expect(progress.watchedIntervals).toEqual([]);
    expect(progress.coverage).toBe(0);
    expect(progress.resumePositionSeconds).toBe(0);
    expect(progress.lastSequence).toBe(0);
    expect(progress.completedAt).toBeNull();
  });

  test("an enrollment has one progress row per video", async () => {
    const { enrollment, video } = await createLearner();
    const data = { enrollmentId: enrollment.id, videoId: video.id };
    await database.prisma.videoProgress.create({ data });

    await expect(database.prisma.videoProgress.create({ data })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  test("merged intervals are stored as written", async () => {
    const { enrollment, video } = await createLearner();

    const progress = await database.prisma.videoProgress.create({
      data: {
        enrollmentId: enrollment.id,
        videoId: video.id,
        watchedIntervals: [
          [0, 30],
          [45, 60],
        ],
        coverage: 0.4,
      },
    });

    expect(progress.watchedIntervals).toEqual([
      [0, 30],
      [45, 60],
    ]);
  });

  test.each([-0.1, 1.1])("coverage %s is rejected", async (coverage) => {
    const { enrollment, video } = await createLearner();

    await expect(
      database.prisma.videoProgress.create({
        data: { enrollmentId: enrollment.id, videoId: video.id, coverage },
      }),
    ).rejects.toThrow(/VideoProgress_coverage_check/);
  });

  test("a negative resume position is rejected", async () => {
    const { enrollment, video } = await createLearner();

    await expect(
      database.prisma.videoProgress.create({
        data: { enrollmentId: enrollment.id, videoId: video.id, resumePositionSeconds: -1 },
      }),
    ).rejects.toThrow(/VideoProgress_resumePositionSeconds_check/);
  });
});

describe("module progress", () => {
  test("a module starts locked", async () => {
    const { enrollment, module } = await createLearner();

    const progress = await database.prisma.moduleProgress.create({
      data: { enrollmentId: enrollment.id, moduleId: module.id },
    });

    expect(progress.status).toBe("LOCKED");
    expect(progress.unlockedAt).toBeNull();
  });

  test("an enrollment has one progress row per module", async () => {
    const { enrollment, module } = await createLearner();
    const data = { enrollmentId: enrollment.id, moduleId: module.id };
    await database.prisma.moduleProgress.create({ data });

    await expect(database.prisma.moduleProgress.create({ data })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  test.each(["LOCKED", "UNLOCKED", "IN_PROGRESS", "QUIZ_READY", "COMPLETED"] as const)(
    "status %s is accepted",
    async (status) => {
      const { enrollment, module } = await createLearner();

      const progress = await database.prisma.moduleProgress.create({
        data: { enrollmentId: enrollment.id, moduleId: module.id, status },
      });

      expect(progress.status).toBe(status);
    },
  );
});

describe("history cannot be deleted from under progress", () => {
  test("a video with progress cannot be hard deleted", async () => {
    const { enrollment, video } = await createLearner();
    await database.prisma.videoProgress.create({
      data: { enrollmentId: enrollment.id, videoId: video.id },
    });

    await expect(database.prisma.video.delete({ where: { id: video.id } })).rejects.toMatchObject({
      code: "P2003",
    });
  });

  test("an enrollment with module progress cannot be hard deleted", async () => {
    const { enrollment, module } = await createLearner();
    await database.prisma.moduleProgress.create({
      data: { enrollmentId: enrollment.id, moduleId: module.id },
    });

    await expect(
      database.prisma.enrollment.delete({ where: { id: enrollment.id } }),
    ).rejects.toMatchObject({ code: "P2003" });
  });
});

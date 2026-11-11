import { NotFoundException } from "@nestjs/common";
import { describe, expect, test, vi } from "vitest";
import { ProgressService } from "../../src/playback/progress.service";

const videoId = "0198f1a0-0000-7000-8000-0000000000a1";
const sessionId = "0198f1a0-0000-7000-8000-0000000000b1";
const started = new Date("2026-11-11T10:00:00.000Z");
const after = (seconds: number): Date => new Date(started.getTime() + seconds * 1000);

interface Options {
  now?: Date;
  session?: object | null;
  enrollmentStatus?: string;
  enrollmentDeletedAt?: Date | null;
  courseRevisionId?: string;
  moduleStatus?: string | null;
  assetStatus?: string;
  duration?: number | null;
  counters?: { acceptedSeconds: number; lastSequence: number };
  progress?: object | null;
  locked?: boolean;
}

const build = (options: Options = {}) => {
  const session =
    options.session === undefined
      ? {
          startedAt: started,
          enrollment: {
            id: "e1",
            status: options.enrollmentStatus ?? "APPROVED",
            courseRevisionId: options.courseRevisionId ?? "rev1",
            deletedAt: options.enrollmentDeletedAt ?? null,
          },
          video: {
            moduleId: "m1",
            deletedAt: null,
            module: { revisionId: "rev1", deletedAt: null },
            asset: {
              status: options.assetStatus ?? "READY",
              durationSeconds: options.duration === undefined ? 100 : options.duration,
            },
          },
        }
      : options.session;
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue(options.locked === false ? [] : [{ id: sessionId }]),
    playbackSession: {
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue(options.counters ?? { acceptedSeconds: 0, lastSequence: 0 }),
      update: vi.fn().mockResolvedValue({}),
    },
    videoProgress: {
      findUnique: vi.fn().mockResolvedValue(options.progress ?? null),
      upsert: vi.fn().mockResolvedValue({}),
    },
    moduleProgress: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  const database = {
    playbackSession: { findFirst: vi.fn().mockResolvedValue(session) },
    moduleProgress: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          options.moduleStatus === null ? null : { status: options.moduleStatus ?? "UNLOCKED" },
        ),
    },
    $transaction: vi.fn().mockImplementation((work: (client: typeof tx) => unknown) => work(tx)),
  };
  const service = new ProgressService(database as never, {
    now: () => options.now ?? after(60),
  });
  return { service, database, tx };
};

const batch = (overrides: object = {}) => ({
  sessionId,
  sequence: 1,
  positionSeconds: 30,
  intervals: [{ start: 0, end: 30 }],
  ...overrides,
});

const savedProgress = (tx: ReturnType<typeof build>["tx"]) =>
  tx.videoProgress.upsert.mock.calls[0]?.[0].update;

describe("ProgressService.record", () => {
  test("stores merged intervals, coverage fraction, resume position and timestamps", async () => {
    const { service, tx } = build();
    const result = await service.record("u1", videoId, batch());
    expect(result).toEqual({ coveragePercent: 30, resumePositionSeconds: 30, completed: false });
    expect(savedProgress(tx)).toEqual({
      watchedIntervals: [{ start: 0, end: 30 }],
      coverage: 0.3,
      resumePositionSeconds: 30,
      lastSequence: 1,
      firstWatchedAt: after(60),
      completedAt: null,
    });
    expect(tx.playbackSession.update).toHaveBeenCalledWith({
      where: { id: sessionId },
      data: { acceptedSeconds: 30, lastSequence: 1, lastSeenAt: after(60) },
    });
  });

  test("looks the session up by id, video and owner", async () => {
    const { service, database } = build();
    await service.record("u1", videoId, batch());
    expect(database.playbackSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: sessionId, videoId, enrollment: { userId: "u1" } },
      }),
    );
  });

  test("a script posting the whole video 10 seconds in gets 15 seconds at most", async () => {
    const { service, tx } = build({ now: after(10), duration: 600 });
    const result = await service.record(
      "u1",
      videoId,
      batch({ positionSeconds: 600, intervals: [{ start: 0, end: 600 }] }),
    );
    expect(savedProgress(tx).watchedIntervals).toEqual([{ start: 0, end: 15 }]);
    expect(savedProgress(tx).coverage).toBe(0.025);
    expect(tx.playbackSession.update.mock.calls[0]?.[0].data.acceptedSeconds).toBe(15);
    expect(result.completed).toBe(false);
  });

  test("budget already used in the session is not granted again", async () => {
    const { service, tx } = build({
      now: after(10),
      duration: 600,
      counters: { acceptedSeconds: 15, lastSequence: 3 },
      progress: {
        watchedIntervals: [{ start: 0, end: 15 }],
        resumePositionSeconds: 15,
        firstWatchedAt: started,
        completedAt: null,
      },
    });
    await service.record(
      "u1",
      videoId,
      batch({ sequence: 4, intervals: [{ start: 0, end: 600 }] }),
    );
    expect(savedProgress(tx).watchedIntervals).toEqual([{ start: 0, end: 15 }]);
    expect(tx.playbackSession.update.mock.calls[0]?.[0].data.acceptedSeconds).toBe(15);
  });

  test("a duplicate batch is idempotent", async () => {
    const stored = {
      watchedIntervals: [{ start: 0, end: 30 }],
      resumePositionSeconds: 30,
      firstWatchedAt: started,
      completedAt: null,
    };
    const { service, tx } = build({
      counters: { acceptedSeconds: 30, lastSequence: 1 },
      progress: stored,
    });
    const result = await service.record("u1", videoId, batch());
    expect(savedProgress(tx).watchedIntervals).toEqual([{ start: 0, end: 30 }]);
    expect(tx.playbackSession.update.mock.calls[0]?.[0].data.acceptedSeconds).toBe(30);
    expect(result.coveragePercent).toBe(30);
    expect(savedProgress(tx).firstWatchedAt).toEqual(started);
  });

  test("a stale sequence never moves the resume position back but still merges within budget", async () => {
    const { service, tx } = build({
      now: after(120),
      counters: { acceptedSeconds: 30, lastSequence: 6 },
      progress: {
        watchedIntervals: [{ start: 0, end: 30 }],
        resumePositionSeconds: 60,
        firstWatchedAt: started,
        completedAt: null,
      },
    });
    const result = await service.record(
      "u1",
      videoId,
      batch({ sequence: 5, positionSeconds: 10, intervals: [{ start: 40, end: 50 }] }),
    );
    expect(result.resumePositionSeconds).toBe(60);
    expect(savedProgress(tx).resumePositionSeconds).toBe(60);
    expect(savedProgress(tx).lastSequence).toBe(6);
    expect(savedProgress(tx).watchedIntervals).toEqual([
      { start: 0, end: 30 },
      { start: 40, end: 50 },
    ]);
    expect(tx.playbackSession.update.mock.calls[0]?.[0].data.lastSequence).toBe(6);
  });

  test("a stale batch cannot exceed the budget either", async () => {
    const { service, tx } = build({
      now: after(20),
      counters: { acceptedSeconds: 30, lastSequence: 6 },
      progress: {
        watchedIntervals: [{ start: 0, end: 30 }],
        resumePositionSeconds: 30,
        firstWatchedAt: started,
        completedAt: null,
      },
    });
    await service.record(
      "u1",
      videoId,
      batch({ sequence: 2, intervals: [{ start: 40, end: 90 }] }),
    );
    expect(savedProgress(tx).watchedIntervals).toEqual([{ start: 0, end: 30 }]);
  });

  test("an offline batch sent after a two minute gap is accepted inside the elapsed budget", async () => {
    const { service, tx } = build({
      now: after(150),
      duration: 600,
      counters: { acceptedSeconds: 30, lastSequence: 2 },
      progress: {
        watchedIntervals: [{ start: 0, end: 30 }],
        resumePositionSeconds: 30,
        firstWatchedAt: started,
        completedAt: null,
      },
    });
    const result = await service.record(
      "u1",
      videoId,
      batch({ sequence: 3, positionSeconds: 150, intervals: [{ start: 30, end: 150 }] }),
    );
    expect(savedProgress(tx).watchedIntervals).toEqual([{ start: 0, end: 150 }]);
    expect(result.coveragePercent).toBe(25);
  });

  test("skipped parts do not count when the student reaches the end", async () => {
    const { service } = build({ now: after(600), duration: 300 });
    const result = await service.record(
      "u1",
      videoId,
      batch({ positionSeconds: 300, intervals: [{ start: 270, end: 300 }] }),
    );
    expect(result.coveragePercent).toBe(10);
    expect(result.resumePositionSeconds).toBe(300);
  });

  test("completes the video in the same transaction at 80 percent coverage", async () => {
    const { service, tx, database } = build({ now: after(120) });
    const result = await service.record(
      "u1",
      videoId,
      batch({ positionSeconds: 80, intervals: [{ start: 0, end: 80 }] }),
    );
    expect(result).toEqual({ coveragePercent: 80, resumePositionSeconds: 80, completed: true });
    expect(savedProgress(tx).completedAt).toEqual(after(120));
    expect(database.$transaction).toHaveBeenCalledTimes(1);
  });

  test("keeps the first completion time on later batches", async () => {
    const completedAt = new Date("2026-11-11T10:05:00.000Z");
    const { service, tx } = build({
      progress: {
        watchedIntervals: [{ start: 0, end: 90 }],
        resumePositionSeconds: 90,
        firstWatchedAt: started,
        completedAt,
      },
      counters: { acceptedSeconds: 90, lastSequence: 1 },
    });
    const result = await service.record("u1", videoId, batch({ sequence: 2, intervals: [] }));
    expect(savedProgress(tx).completedAt).toEqual(completedAt);
    expect(result.completed).toBe(true);
  });

  test("moves an unlocked module to in progress on the first heartbeat", async () => {
    const { service, tx } = build({ moduleStatus: "UNLOCKED" });
    await service.record("u1", videoId, batch());
    expect(tx.moduleProgress.updateMany).toHaveBeenCalledWith({
      where: { enrollmentId: "e1", moduleId: "m1", status: "UNLOCKED" },
      data: { status: "IN_PROGRESS", startedAt: after(60) },
    });
  });

  test("leaves a module that is already further along alone", async () => {
    for (const status of ["IN_PROGRESS", "QUIZ_READY", "COMPLETED"]) {
      const { service, tx } = build({ moduleStatus: status });
      await service.record("u1", videoId, batch());
      expect(tx.moduleProgress.updateMany).not.toHaveBeenCalled();
    }
  });

  test("rewatching a completed enrollment does not touch module progress", async () => {
    const { service, tx } = build({ enrollmentStatus: "COMPLETED", moduleStatus: "UNLOCKED" });
    await service.record("u1", videoId, batch());
    expect(tx.moduleProgress.updateMany).not.toHaveBeenCalled();
  });

  test.each(["REMOVED", "PENDING_APPROVAL", "PENDING_VERIFICATION", "REJECTED"])(
    "refuses a %s enrollment with 403 and writes nothing",
    async (status) => {
      const { service, database } = build({ enrollmentStatus: status });
      await expect(service.record("u1", videoId, batch())).rejects.toMatchObject({
        status: 403,
        code: "ENROLLMENT_NOT_ACTIVE",
      });
      expect(database.$transaction).not.toHaveBeenCalled();
    },
  );

  test("refuses a soft-deleted enrollment with 403", async () => {
    const { service } = build({ enrollmentDeletedAt: started });
    await expect(service.record("u1", videoId, batch())).rejects.toMatchObject({ status: 403 });
  });

  test("refuses a locked or missing module progress with 403", async () => {
    await expect(
      build({ moduleStatus: "LOCKED" }).service.record("u1", videoId, batch()),
    ).rejects.toMatchObject({ status: 403, code: "MODULE_LOCKED" });
    await expect(
      build({ moduleStatus: null }).service.record("u1", videoId, batch()),
    ).rejects.toMatchObject({ status: 403, code: "MODULE_LOCKED" });
  });

  test("refuses a video that is not ready or has no duration with 409", async () => {
    await expect(
      build({ assetStatus: "PROCESSING" }).service.record("u1", videoId, batch()),
    ).rejects.toMatchObject({ status: 409, code: "VIDEO_NOT_READY" });
    await expect(
      build({ duration: null }).service.record("u1", videoId, batch()),
    ).rejects.toMatchObject({ status: 409, code: "VIDEO_NOT_READY" });
  });

  test("answers 404 for a session that is not the caller's or not for this video", async () => {
    await expect(
      build({ session: null }).service.record("u1", videoId, batch()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  test("answers 404 when the learner is on another revision or the video was deleted", async () => {
    await expect(
      build({ courseRevisionId: "rev2" }).service.record("u1", videoId, batch()),
    ).rejects.toBeInstanceOf(NotFoundException);
    const deleted = build({
      session: {
        startedAt: started,
        enrollment: { id: "e1", status: "APPROVED", courseRevisionId: "rev1", deletedAt: null },
        video: {
          moduleId: "m1",
          deletedAt: started,
          module: { revisionId: "rev1", deletedAt: null },
          asset: { status: "READY", durationSeconds: 100 },
        },
      },
    });
    await expect(deleted.service.record("u1", videoId, batch())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  test("answers 404 when the session row disappears before it can be locked", async () => {
    await expect(
      build({ locked: false }).service.record("u1", videoId, batch()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  test("treats unreadable stored intervals as empty", async () => {
    const { service, tx } = build({
      progress: {
        watchedIntervals: "garbage",
        resumePositionSeconds: 0,
        firstWatchedAt: null,
        completedAt: null,
      },
    });
    await service.record("u1", videoId, batch());
    expect(savedProgress(tx).watchedIntervals).toEqual([{ start: 0, end: 30 }]);
  });
});

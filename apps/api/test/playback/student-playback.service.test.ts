import { NotFoundException } from "@nestjs/common";
import { describe, expect, test, vi } from "vitest";
import { StudentPlaybackService } from "../../src/playback/student-playback.service";

const videoId = "0198f1a0-0000-7000-8000-0000000000a1";
const now = new Date("2026-11-11T10:00:00.000Z");
const assetKey = "abcdefghijklmnopqrstuvwxyz012345";

interface Options {
  video?: object | null;
  enrollment?: { id: string; status: string; courseRevisionId: string | null } | null;
  moduleStatus?: string | null;
  resume?: number | null;
  openSession?: { id: string } | null;
}

const build = (options: Options = {}) => {
  const video =
    options.video === undefined
      ? {
          moduleId: "m1",
          module: { revisionId: "rev1", revision: { courseId: "c1" } },
          asset: {
            assetKey,
            status: "READY",
            durationSeconds: 600,
            captions: [{ language: "en" }],
          },
        }
      : options.video;
  const enrollment =
    options.enrollment === undefined
      ? { id: "e1", status: "APPROVED", courseRevisionId: "rev1" }
      : options.enrollment;
  const database = {
    video: { findFirst: vi.fn().mockResolvedValue(video) },
    enrollment: { findFirst: vi.fn().mockResolvedValue(enrollment) },
    moduleProgress: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          options.moduleStatus === null ? null : { status: options.moduleStatus ?? "UNLOCKED" },
        ),
    },
    videoProgress: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          options.resume === null || options.resume === undefined
            ? null
            : { resumePositionSeconds: options.resume },
        ),
    },
    playbackSession: {
      create: vi.fn().mockResolvedValue({ id: "0198f1a0-0000-7000-8000-0000000000b1" }),
      findFirst: vi.fn().mockResolvedValue(options.openSession ?? null),
      update: vi
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) =>
          Promise.resolve({ id: where.id }),
        ),
    },
  };
  const issue = vi.fn().mockReturnValue({
    value: "k1.1.sig",
    expiresAt: "2026-11-11T10:10:00.000Z",
    maxAgeMilliseconds: 600_000,
  });
  const service = new StudentPlaybackService(database as never, { issue } as never, {
    now: () => now,
  });
  return { service, database, issue };
};

describe("StudentPlaybackService.start", () => {
  test("signs over the asset key and returns resume, captions and the session id", async () => {
    const { service, database, issue } = build({ resume: 42 });
    const grant = await service.start("u1", videoId);
    expect(issue).toHaveBeenCalledWith(assetKey);
    expect(grant.assetKey).toBe(assetKey);
    expect(grant.body).toEqual({
      expiresAt: "2026-11-11T10:10:00.000Z",
      manifestPath: `/hls/${assetKey}/master.m3u8`,
      sessionId: "0198f1a0-0000-7000-8000-0000000000b1",
      resumePositionSeconds: 42,
      captions: [{ language: "en" }],
    });
    expect(database.playbackSession.create).toHaveBeenCalledWith({
      data: { enrollmentId: "e1", videoId, positionClaimedAt: now },
      select: { id: true },
    });
    expect(database.enrollment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1", courseId: "c1", deletedAt: null } }),
    );
  });

  test("restarts at zero when the stored position is at the end of the video", async () => {
    const { service } = build({ resume: 598 });
    expect((await service.start("u1", videoId)).body.resumePositionSeconds).toBe(0);
  });

  test("resumes at zero when there is no progress", async () => {
    const { service } = build();
    expect((await service.start("u1", videoId)).body.resumePositionSeconds).toBe(0);
  });

  test("grants a completed student on a module with no progress row", async () => {
    const { service } = build({
      enrollment: { id: "e1", status: "COMPLETED", courseRevisionId: "rev1" },
      moduleStatus: null,
    });
    await expect(service.start("u1", videoId)).resolves.toBeDefined();
  });

  test.each([
    ["PENDING_VERIFICATION", null],
    ["PENDING_APPROVAL", null],
    ["REJECTED", null],
    ["REMOVED", "rev1"],
  ])("refuses a %s enrollment and signs nothing", async (status, courseRevisionId) => {
    const { service, issue, database } = build({
      enrollment: { id: "e1", status, courseRevisionId },
    });
    await expect(service.start("u1", videoId)).rejects.toMatchObject({
      code: "ENROLLMENT_NOT_ACTIVE",
    });
    expect(issue).not.toHaveBeenCalled();
    expect(database.playbackSession.create).not.toHaveBeenCalled();
  });

  test("refuses a student with no enrollment in the course", async () => {
    const { service } = build({ enrollment: null });
    await expect(service.start("u1", videoId)).rejects.toMatchObject({
      code: "ENROLLMENT_NOT_ACTIVE",
    });
  });

  test("refuses a locked module", async () => {
    const { service } = build({ moduleStatus: "LOCKED" });
    await expect(service.start("u1", videoId)).rejects.toMatchObject({ code: "MODULE_LOCKED" });
  });

  test("refuses a video that is not ready", async () => {
    const { service } = build({
      video: {
        moduleId: "m1",
        module: { revisionId: "rev1", revision: { courseId: "c1" } },
        asset: { assetKey, status: "PROCESSING", captions: [] },
      },
    });
    await expect(service.start("u1", videoId)).rejects.toMatchObject({ code: "VIDEO_NOT_READY" });
  });

  test("refuses a slot without an asset", async () => {
    const { service } = build({
      video: {
        moduleId: "m1",
        module: { revisionId: "rev1", revision: { courseId: "c1" } },
        asset: null,
      },
    });
    await expect(service.start("u1", videoId)).rejects.toMatchObject({ code: "VIDEO_NOT_READY" });
  });

  test("answers not found for an unknown video", async () => {
    const { service } = build({ video: null });
    await expect(service.start("u1", videoId)).rejects.toBeInstanceOf(NotFoundException);
  });

  test("answers not found when the module is from another revision than the enrollment", async () => {
    const { service } = build({
      enrollment: { id: "e1", status: "APPROVED", courseRevisionId: "rev0" },
    });
    await expect(service.start("u1", videoId)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("StudentPlaybackService.refresh", () => {
  test("reissues the cookie and keeps the open session start time", async () => {
    const { service, database } = build({ openSession: { id: "s-open" } });
    const grant = await service.refresh("u1", videoId);
    expect(grant.body.sessionId).toBe("s-open");
    expect(database.playbackSession.update).toHaveBeenCalledWith({
      where: { id: "s-open" },
      data: { lastSeenAt: now, positionClaimedAt: now },
      select: { id: true },
    });
    expect(database.playbackSession.create).not.toHaveBeenCalled();
  });

  test("opens a session when none is open", async () => {
    const { service, database } = build();
    await service.refresh("u1", videoId);
    expect(database.playbackSession.create).toHaveBeenCalledTimes(1);
  });

  test("refuses a student who was removed since the last session", async () => {
    const { service, issue } = build({
      enrollment: { id: "e1", status: "REMOVED", courseRevisionId: "rev1" },
      openSession: { id: "s-open" },
    });
    await expect(service.refresh("u1", videoId)).rejects.toMatchObject({
      code: "ENROLLMENT_NOT_ACTIVE",
    });
    expect(issue).not.toHaveBeenCalled();
  });
});

import { NotFoundException } from "@nestjs/common";
import { describe, expect, test, vi } from "vitest";
import { AdminPlaybackService } from "../../src/playback/admin-playback.service";

const assetKey = "abcdefghijklmnopqrstuvwxyz012345";
const videoId = "0198f1a0-0000-7000-8000-0000000000a1";

const build = (video: object | null) => {
  const database = { video: { findFirst: vi.fn().mockResolvedValue(video) } };
  const issue = vi.fn().mockReturnValue({
    value: "k1.1.sig",
    expiresAt: "2026-11-11T10:10:00.000Z",
    maxAgeMilliseconds: 600_000,
  });
  return { service: new AdminPlaybackService(database as never, { issue } as never), issue };
};

describe("AdminPlaybackService", () => {
  test("signs over the asset key of a ready video without an enrollment", async () => {
    const { service, issue } = build({
      asset: { assetKey, status: "READY", captions: [{ language: "en" }] },
    });
    const grant = await service.preview(videoId);
    expect(issue).toHaveBeenCalledWith(assetKey);
    expect(grant.assetKey).toBe(assetKey);
    expect(grant.body).toEqual({
      expiresAt: "2026-11-11T10:10:00.000Z",
      manifestPath: `/hls/${assetKey}/master.m3u8`,
      sessionId: null,
      resumePositionSeconds: 0,
      captions: [{ language: "en" }],
    });
  });

  test.each(["PROCESSING", "FAILED", "REJECTED", "QUEUED"])(
    "refuses a %s video with 409 VIDEO_NOT_READY",
    async (status) => {
      const { service, issue } = build({ asset: { assetKey, status, captions: [] } });
      await expect(service.preview(videoId)).rejects.toMatchObject({ code: "VIDEO_NOT_READY" });
      expect(issue).not.toHaveBeenCalled();
    },
  );

  test("refuses a slot with no asset", async () => {
    const { service } = build({ asset: null });
    await expect(service.preview(videoId)).rejects.toMatchObject({ code: "VIDEO_NOT_READY" });
  });

  test("answers not found for an unknown video", async () => {
    const { service } = build(null);
    await expect(service.preview(videoId)).rejects.toBeInstanceOf(NotFoundException);
  });
});

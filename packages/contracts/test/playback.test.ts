import { describe, expect, test } from "vitest";
import {
  hlsCookie,
  hlsCookiePath,
  hlsManifestPath,
  playbackAdminParamsSchema,
  playbackSessionResponseSchema,
  playbackVideoIdSchema,
  playbackVideoParamsSchema,
} from "../src";

describe("playback contracts", () => {
  test("the cookie is named hls_sig and lasts ten minutes", () => {
    expect(hlsCookie).toEqual({ name: "hls_sig", ttlSeconds: 600 });
  });

  test("the cookie path is scoped to one video", () => {
    expect(hlsCookiePath("abc_1")).toBe("/hls/abc_1/");
  });

  test.each(["abc", "A-b_9", "x".repeat(64)])("accepts the video id %s", (id) => {
    expect(playbackVideoIdSchema.safeParse(id).success).toBe(true);
  });

  test.each(["", "a/b", "..", "a b", "a.b", "a%2e", "x".repeat(65), "a\\b"])(
    "rejects the video id %j",
    (id) => {
      expect(playbackVideoIdSchema.safeParse(id).success).toBe(false);
    },
  );

  test("the response carries an ISO expiry", () => {
    const session = {
      expiresAt: "2026-11-11T10:10:00.000Z",
      manifestPath: "/hls/abc_1/master.m3u8",
      sessionId: null,
      resumePositionSeconds: 0,
      captions: [{ language: "en" }],
    };
    expect(playbackSessionResponseSchema.safeParse(session).success).toBe(true);
    expect(
      playbackSessionResponseSchema.safeParse({ ...session, expiresAt: "soon" }).success,
    ).toBe(false);
    expect(
      playbackSessionResponseSchema.safeParse({ ...session, resumePositionSeconds: -1 }).success,
    ).toBe(false);
  });

  test("the manifest path sits under the cookie path", () => {
    expect(hlsManifestPath("abc_1")).toBe("/hls/abc_1/master.m3u8");
    expect(hlsManifestPath("abc_1").startsWith(hlsCookiePath("abc_1"))).toBe(true);
  });

  test("the params require a uuid", () => {
    expect(playbackVideoParamsSchema.safeParse({ id: "x" }).success).toBe(false);
    expect(
      playbackAdminParamsSchema.safeParse({ videoId: "0198f1a0-0000-7000-8000-0000000000c1" })
        .success,
    ).toBe(true);
  });
});

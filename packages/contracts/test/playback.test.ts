import { describe, expect, test } from "vitest";
import {
  hlsCookie,
  hlsCookiePath,
  playbackSessionResponseSchema,
  playbackVideoIdSchema,
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
    expect(
      playbackSessionResponseSchema.safeParse({ expiresAt: "2026-11-11T10:10:00.000Z" }).success,
    ).toBe(true);
    expect(playbackSessionResponseSchema.safeParse({ expiresAt: "soon" }).success).toBe(false);
  });
});

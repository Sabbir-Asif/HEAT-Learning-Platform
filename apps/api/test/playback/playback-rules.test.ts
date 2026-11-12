import { describe, expect, test } from "vitest";
import { ApiException } from "../../src/http/api-exception";
import { playbackRefusal } from "../../src/playback/playback-rules";
import type { PlaybackFacts } from "../../src/playback/playback-rules";

const facts = (overrides: Partial<PlaybackFacts> = {}): PlaybackFacts => ({
  enrollmentStatus: "APPROVED",
  moduleStatus: "UNLOCKED",
  assetStatus: "READY",
  ...overrides,
});

const refusal = (overrides: Partial<PlaybackFacts>) => {
  const result = playbackRefusal(facts(overrides));
  return result === null ? null : { status: result.getStatus(), code: result.code };
};

describe("playbackRefusal", () => {
  test("grants an approved student on an unlocked module with a ready video", () => {
    expect(playbackRefusal(facts())).toBeNull();
  });

  test.each(["UNLOCKED", "IN_PROGRESS", "QUIZ_READY", "COMPLETED"] as const)(
    "grants an approved student on a %s module",
    (moduleStatus) => {
      expect(playbackRefusal(facts({ moduleStatus }))).toBeNull();
    },
  );

  test("grants a completed student any module so they can rewatch", () => {
    expect(
      playbackRefusal(facts({ enrollmentStatus: "COMPLETED", moduleStatus: "LOCKED" })),
    ).toBeNull();
    expect(
      playbackRefusal(facts({ enrollmentStatus: "COMPLETED", moduleStatus: null })),
    ).toBeNull();
  });

  test.each([
    "PENDING_VERIFICATION",
    "PENDING_APPROVAL",
    "REJECTED",
    "EXPIRED",
    "REMOVED",
  ] as const)("refuses a %s enrollment with 403 ENROLLMENT_NOT_ACTIVE", (enrollmentStatus) => {
    expect(refusal({ enrollmentStatus })).toEqual({ status: 403, code: "ENROLLMENT_NOT_ACTIVE" });
  });

  test("refuses a missing enrollment", () => {
    expect(refusal({ enrollmentStatus: null })).toEqual({
      status: 403,
      code: "ENROLLMENT_NOT_ACTIVE",
    });
  });

  test.each(["LOCKED", null] as const)(
    "refuses a %s module with 403 MODULE_LOCKED",
    (moduleStatus) => {
      expect(refusal({ moduleStatus })).toEqual({ status: 403, code: "MODULE_LOCKED" });
    },
  );

  test.each(["UPLOADING", "UPLOADED", "QUEUED", "PROCESSING", "FAILED", "REJECTED", null] as const)(
    "refuses a %s video with 409 VIDEO_NOT_READY",
    (assetStatus) => {
      expect(refusal({ assetStatus })).toEqual({ status: 409, code: "VIDEO_NOT_READY" });
    },
  );

  test("checks enrollment before the lock and the lock before the video", () => {
    expect(
      refusal({ enrollmentStatus: "REMOVED", moduleStatus: "LOCKED", assetStatus: "FAILED" }),
    ).toEqual({ status: 403, code: "ENROLLMENT_NOT_ACTIVE" });
    expect(refusal({ moduleStatus: "LOCKED", assetStatus: "FAILED" })).toEqual({
      status: 403,
      code: "MODULE_LOCKED",
    });
  });

  test("returns an ApiException", () => {
    expect(playbackRefusal(facts({ moduleStatus: "LOCKED" }))).toBeInstanceOf(ApiException);
  });
});

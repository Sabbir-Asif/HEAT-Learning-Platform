import { describe, expect, test } from "vitest";
import { assertRequiredFlagUnlocked, slotStatusOf } from "../../src/catalog/video-rules";

const lockedAt = new Date("2026-11-11T06:00:00.000Z");

describe("slotStatusOf", () => {
  test("a slot without an asset shows that no video is uploaded", () => {
    expect(slotStatusOf(null)).toBe("NOT_UPLOADED");
  });

  test("a slot with an asset shows the asset status", () => {
    expect(slotStatusOf({ status: "PROCESSING" })).toBe("PROCESSING");
  });
});

describe("assertRequiredFlagUnlocked", () => {
  test("a changed flag on a locked course is refused", () => {
    expect(() => assertRequiredFlagUnlocked(lockedAt, true, false)).toThrowError(
      expect.objectContaining({ code: "CONTENT_LOCKED" }),
    );
  });

  test("an unchanged flag on a locked course is allowed", () => {
    expect(() => assertRequiredFlagUnlocked(lockedAt, true, true)).not.toThrow();
  });

  test("a changed flag on an unlocked course is allowed", () => {
    expect(() => assertRequiredFlagUnlocked(null, true, false)).not.toThrow();
  });
});

import { describe, expect, test } from "vitest";
import { isContentLocked } from "../../src/courses/courses-status";

const at = "2026-11-19T06:00:00.000Z";

describe("isContentLocked", () => {
  test("is open before the course is ever published", () => {
    expect(isContentLocked({ lockedAt: null, currentRevision: { publishedAt: null } })).toBe(false);
  });

  test("is locked while the latest revision is published", () => {
    expect(isContentLocked({ lockedAt: at, currentRevision: { publishedAt: at } })).toBe(true);
  });

  test("is open again once a new draft revision exists", () => {
    expect(isContentLocked({ lockedAt: at, currentRevision: { publishedAt: null } })).toBe(false);
  });
});

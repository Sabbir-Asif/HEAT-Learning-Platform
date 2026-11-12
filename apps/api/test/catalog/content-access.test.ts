import { describe, expect, test, vi } from "vitest";
import { readScope } from "../../src/catalog/content-access";

const clientWith = (lockedAt: Date | null, publishedAt: Date | null) => ({
  course: {
    findUnique: vi
      .fn()
      .mockResolvedValue({ lockedAt, revisions: [{ id: "revision-id", publishedAt }] }),
  },
});

describe("readScope", () => {
  const lockedAt = new Date("2026-10-01T00:00:00.000Z");

  test("reports the course lock for a published latest revision", async () => {
    const scope = await readScope(clientWith(lockedAt, new Date(0)) as never, "course-id");
    expect(scope.lockedAt).toEqual(lockedAt);
  });

  test("treats a draft latest revision as unlocked even when the course is locked", async () => {
    const scope = await readScope(clientWith(lockedAt, null) as never, "course-id");
    expect(scope).toEqual({ revisionId: "revision-id", lockedAt: null, courseLockedAt: lockedAt });
  });
});

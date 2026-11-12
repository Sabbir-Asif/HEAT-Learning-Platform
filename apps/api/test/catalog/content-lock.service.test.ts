import { describe, expect, test, vi } from "vitest";
import { ContentLockService } from "../../src/catalog/content-lock.service";

const build = (lockedAt: Date | null, revisionPublishedAt: Date | null = new Date(0)) => {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ lockedAt }]),
    course: {
      findUnique: vi.fn().mockResolvedValue({
        lockedAt,
        revisions: [{ id: "revision-id", publishedAt: revisionPublishedAt }],
      }),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  return { tx, service: new ContentLockService() };
};

describe("ContentLockService.lockOnFirstApproval", () => {
  const now = new Date("2026-11-11T05:00:00.000Z");

  test("locks an unlocked course and reports that it did", async () => {
    const { tx, service } = build(null);

    await expect(service.lockOnFirstApproval(tx as never, "course-id", now)).resolves.toBe(true);
    expect(tx.course.update).toHaveBeenCalledWith({
      where: { id: "course-id" },
      data: { lockedAt: now },
    });
  });

  test("leaves an already locked course untouched", async () => {
    const lockedAt = new Date("2026-10-01T00:00:00.000Z");
    const { tx, service } = build(lockedAt);

    await expect(service.lockOnFirstApproval(tx as never, "course-id", now)).resolves.toBe(false);
    expect(tx.course.update).not.toHaveBeenCalled();
  });

  test("leaves a locked course untouched while its latest revision is a draft", async () => {
    const lockedAt = new Date("2026-10-01T00:00:00.000Z");
    const { tx, service } = build(lockedAt, null);

    await expect(service.lockOnFirstApproval(tx as never, "course-id", now)).resolves.toBe(false);
    expect(tx.course.update).not.toHaveBeenCalled();
  });
});

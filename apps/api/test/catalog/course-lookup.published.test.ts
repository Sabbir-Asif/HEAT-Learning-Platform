import { describe, expect, test, vi } from "vitest";
import { CourseLookupService } from "../../src/catalog/course-lookup.service";
import { ApiException } from "../../src/http/api-exception";

describe("CourseLookupService.resolveApprovalTarget", () => {
  test("returns the latest published revision with its live modules in order", async () => {
    const tx = {
      courseRevision: {
        findFirst: vi.fn().mockResolvedValue({
          id: "revision-id",
          modules: [{ id: "m1" }, { id: "m2" }],
        }),
      },
    };
    const service = new CourseLookupService({} as never);

    await expect(service.resolveApprovalTarget("course-id", tx as never)).resolves.toEqual({
      revisionId: "revision-id",
      moduleIds: ["m1", "m2"],
    });
    expect(tx.courseRevision.findFirst).toHaveBeenCalledWith({
      where: { courseId: "course-id", publishedAt: { not: null }, deletedAt: null },
      orderBy: { number: "desc" },
      select: {
        id: true,
        modules: { where: { deletedAt: null }, orderBy: { order: "asc" }, select: { id: true } },
      },
    });
  });

  test("refuses a course with no published revision or no modules", async () => {
    const service = new CourseLookupService({} as never);
    const none = { courseRevision: { findFirst: vi.fn().mockResolvedValue(null) } };
    const empty = {
      courseRevision: { findFirst: vi.fn().mockResolvedValue({ id: "r", modules: [] }) },
    };

    for (const tx of [none, empty]) {
      const failure = await service
        .resolveApprovalTarget("course-id", tx as never)
        .catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(ApiException);
      expect(failure).toMatchObject({ code: "COURSE_NOT_AVAILABLE" });
    }
  });
});

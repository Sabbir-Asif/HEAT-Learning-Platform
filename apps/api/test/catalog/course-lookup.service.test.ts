import { describe, expect, test, vi } from "vitest";
import { CourseLookupService } from "../../src/catalog/course-lookup.service";
import { ApiException } from "../../src/http/api-exception";

const build = (found: { id: string } | null) => {
  const database = { course: { findFirst: vi.fn().mockResolvedValue(found) } };
  return { database, service: new CourseLookupService(database as never) };
};

describe("CourseLookupService.resolveOpenForEnrollment", () => {
  test("finds a live published course by slug", async () => {
    const { service, database } = build({ id: "course-id" });

    await expect(service.resolveOpenForEnrollment("gender-safety")).resolves.toEqual({
      id: "course-id",
    });
    expect(database.course.findFirst).toHaveBeenCalledWith({
      where: { slug: "gender-safety", status: "PUBLISHED", deletedAt: null },
      select: { id: true },
    });
  });

  test("refuses an unknown, draft or deleted course with one stable code", async () => {
    const { service } = build(null);

    const failure = await service.resolveOpenForEnrollment("nope").catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiException);
    expect(failure).toMatchObject({ code: "COURSE_NOT_AVAILABLE" });
    expect((failure as ApiException).getStatus()).toBe(404);
  });

  test("uses the transaction client when given one", async () => {
    const { service, database } = build(null);
    const tx = { course: { findFirst: vi.fn().mockResolvedValue({ id: "c" }) } };

    await service.resolveOpenForEnrollment("heat", tx as never);

    expect(tx.course.findFirst).toHaveBeenCalled();
    expect(database.course.findFirst).not.toHaveBeenCalled();
  });
});

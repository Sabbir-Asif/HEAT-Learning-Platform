import type { HeatClient } from "@heat/db";
import { describe, expect, test, vi } from "vitest";
import { EnrollmentAccessService } from "../../src/access/enrollment-access.service";

const courseId = "0197a1b2-0000-7000-8000-000000000001";

const build = (found: { id: string } | null) => {
  const findFirst = vi.fn().mockResolvedValue(found);
  const service = new EnrollmentAccessService({
    enrollment: { findFirst },
  } as unknown as HeatClient);
  return { service, findFirst };
};

describe("EnrollmentAccessService", () => {
  test("queries only approved and completed, undeleted enrollments of the user and course", async () => {
    const { service, findFirst } = build({ id: "e" });

    await expect(service.hasActiveEnrollment("u", courseId)).resolves.toBe(true);

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        userId: "u",
        courseId,
        deletedAt: null,
        status: { in: ["APPROVED", "COMPLETED"] },
      },
      select: { id: true },
    });
  });

  test("is false when no row matches", async () => {
    const { service } = build(null);

    await expect(service.hasActiveEnrollment("u", courseId)).resolves.toBe(false);
  });

  test("is false for a value that is not a UUID, without querying", async () => {
    const { service, findFirst } = build({ id: "e" });

    await expect(service.hasActiveEnrollment("u", "not-a-uuid")).resolves.toBe(false);
    await expect(service.hasActiveEnrollment("u", "")).resolves.toBe(false);
    expect(findFirst).not.toHaveBeenCalled();
  });
});

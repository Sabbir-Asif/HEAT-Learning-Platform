import { NotFoundException } from "@nestjs/common";
import { describe, expect, test } from "vitest";
import { requireLearnableEnrollment } from "../../src/learning/course-access";

const row = (overrides: object = {}) => ({
  id: "e1",
  status: "APPROVED" as const,
  courseRevisionId: "r1",
  course: { deletedAt: null },
  courseRevision: { id: "r1", number: 3, deletedAt: null },
  ...overrides,
});

describe("requireLearnableEnrollment", () => {
  test("no enrollment is refused with 403 ENROLLMENT_NOT_ACTIVE", () => {
    expect(() => requireLearnableEnrollment(null)).toThrowError(
      expect.objectContaining({ code: "ENROLLMENT_NOT_ACTIVE", status: 403 }),
    );
  });

  test.each([
    "PENDING_VERIFICATION",
    "PENDING_APPROVAL",
    "REJECTED",
    "EXPIRED",
    "REMOVED",
  ] as const)(
    "a %s enrollment is refused with 403 ENROLLMENT_NOT_ACTIVE before the revision is looked at",
    (status) => {
      expect(() =>
        requireLearnableEnrollment(row({ status, courseRevisionId: null, courseRevision: null })),
      ).toThrowError(expect.objectContaining({ code: "ENROLLMENT_NOT_ACTIVE", status: 403 }));
    },
  );

  test.each(["APPROVED", "COMPLETED"] as const)(
    "a %s enrollment returns the pinned revision",
    (status) => {
      expect(requireLearnableEnrollment(row({ status }))).toEqual({
        enrollmentId: "e1",
        status,
        revisionId: "r1",
        revisionNumber: 3,
      });
    },
  );

  test("an active enrollment without a live pinned revision or course is not found", () => {
    expect(() =>
      requireLearnableEnrollment(row({ courseRevisionId: null, courseRevision: null })),
    ).toThrow(NotFoundException);
    expect(() =>
      requireLearnableEnrollment(
        row({ courseRevision: { id: "r1", number: 3, deletedAt: new Date() } }),
      ),
    ).toThrow(NotFoundException);
    expect(() => requireLearnableEnrollment(row({ course: { deletedAt: new Date() } }))).toThrow(
      NotFoundException,
    );
  });
});

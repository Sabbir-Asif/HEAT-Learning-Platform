import { describe, expect, test } from "vitest";
import {
  assertCanDelete,
  assertCanPublish,
  assertLockedEditAllowed,
} from "../../src/catalog/course-rules";
import { ApiException } from "../../src/http/api-exception";

const codeOf = (run: () => void): unknown => {
  try {
    run();
  } catch (error) {
    if (error instanceof ApiException) return [error.getStatus(), error.code];
    throw error;
  }
  return null;
};

describe("assertCanPublish", () => {
  test("allows a draft course", () => {
    expect(codeOf(() => assertCanPublish("DRAFT"))).toBeNull();
  });

  test("refuses a course that is already published", () => {
    expect(codeOf(() => assertCanPublish("PUBLISHED"))).toEqual([409, "COURSE_NOT_DRAFT"]);
  });
});

describe("assertCanDelete", () => {
  test("allows a draft course without enrollments", () => {
    expect(codeOf(() => assertCanDelete({ status: "DRAFT", enrollmentCount: 0 }))).toBeNull();
  });

  test("refuses a course with any enrollment", () => {
    expect(codeOf(() => assertCanDelete({ status: "DRAFT", enrollmentCount: 1 }))).toEqual([
      409,
      "COURSE_HAS_ENROLLMENTS",
    ]);
  });

  test("refuses a published course", () => {
    expect(codeOf(() => assertCanDelete({ status: "PUBLISHED", enrollmentCount: 0 }))).toEqual([
      409,
      "COURSE_NOT_DRAFT",
    ]);
  });
});

describe("assertLockedEditAllowed", () => {
  const before = { title: "HEAT", slug: "heat", lockedAt: new Date() };

  test("allows changing description and thumbnail on a locked course", () => {
    expect(
      codeOf(() => assertLockedEditAllowed(before, { title: "HEAT", slug: "heat" })),
    ).toBeNull();
  });

  test("refuses a new title or slug on a locked course", () => {
    const expected = [409, "COURSE_LOCKED"];
    expect(codeOf(() => assertLockedEditAllowed(before, { title: "Other", slug: "heat" }))).toEqual(
      expected,
    );
    expect(codeOf(() => assertLockedEditAllowed(before, { title: "HEAT", slug: "other" }))).toEqual(
      expected,
    );
  });

  test("allows any change on a course that is not locked", () => {
    expect(
      codeOf(() =>
        assertLockedEditAllowed({ ...before, lockedAt: null }, { title: "Other", slug: "other" }),
      ),
    ).toBeNull();
  });
});

import { describe, expect, test } from "vitest";
import {
  assertCanCloneRevision,
  assertCanPublishRevision,
  referenceIncrements,
  revisionLocked,
  revisionStatus,
} from "../../src/catalog/revision-rules";
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

const published = new Date("2026-11-01T00:00:00.000Z");

describe("assertCanCloneRevision", () => {
  test("allows cloning when the latest revision is published", () => {
    expect(codeOf(() => assertCanCloneRevision({ publishedAt: published }))).toBeNull();
  });

  test("refuses when a draft revision already exists", () => {
    expect(codeOf(() => assertCanCloneRevision({ publishedAt: null }))).toEqual([
      409,
      "COURSE_REVISION_DRAFT_EXISTS",
    ]);
  });
});

describe("assertCanPublishRevision", () => {
  test("allows the latest unpublished revision of a published course", () => {
    expect(
      codeOf(() =>
        assertCanPublishRevision({
          courseStatus: "PUBLISHED",
          requestedId: "a",
          latest: { id: "a", publishedAt: null },
        }),
      ),
    ).toBeNull();
  });

  test("refuses a course that is not published", () => {
    expect(
      codeOf(() =>
        assertCanPublishRevision({
          courseStatus: "DRAFT",
          requestedId: "a",
          latest: { id: "a", publishedAt: null },
        }),
      ),
    ).toEqual([409, "COURSE_NOT_PUBLISHED"]);
  });

  test("refuses a revision that is not the latest", () => {
    expect(
      codeOf(() =>
        assertCanPublishRevision({
          courseStatus: "PUBLISHED",
          requestedId: "old",
          latest: { id: "a", publishedAt: null },
        }),
      ),
    ).toEqual([409, "COURSE_REVISION_NOT_DRAFT"]);
  });

  test("refuses a revision that is already published", () => {
    expect(
      codeOf(() =>
        assertCanPublishRevision({
          courseStatus: "PUBLISHED",
          requestedId: "a",
          latest: { id: "a", publishedAt: published },
        }),
      ),
    ).toEqual([409, "COURSE_REVISION_NOT_DRAFT"]);
  });
});

describe("revisionStatus and revisionLocked", () => {
  test("a revision without a publish time is a draft", () => {
    expect(revisionStatus(null)).toBe("DRAFT");
    expect(revisionStatus(published)).toBe("PUBLISHED");
  });

  test("a draft is never locked", () => {
    expect(revisionLocked({ publishedAt: null, enrollmentCount: 3, latest: true })).toBe(false);
  });

  test("a published revision with enrollments is locked", () => {
    expect(revisionLocked({ publishedAt: published, enrollmentCount: 1, latest: true })).toBe(true);
  });

  test("a published revision that is superseded is locked", () => {
    expect(revisionLocked({ publishedAt: published, enrollmentCount: 0, latest: false })).toBe(
      true,
    );
  });

  test("the latest published revision without enrollments is still editable", () => {
    expect(revisionLocked({ publishedAt: published, enrollmentCount: 0, latest: true })).toBe(
      false,
    );
  });
});

describe("referenceIncrements", () => {
  test("counts each asset once per slot and skips empty slots", () => {
    const increments = referenceIncrements(["a", null, "b", "a"]);
    expect([...increments.entries()].sort()).toEqual([
      ["a", 2],
      ["b", 1],
    ]);
  });

  test("returns nothing for no slots", () => {
    expect(referenceIncrements([]).size).toBe(0);
  });
});

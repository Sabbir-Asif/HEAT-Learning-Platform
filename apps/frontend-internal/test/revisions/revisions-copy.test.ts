import type { CourseRevisionItemDto } from "@heat/api-client";
import { describe, expect, test } from "vitest";
import {
  canCloneRevisions,
  cloneRevisionFailedMessage,
  draftRevisionOf,
  publishRevisionFailedMessage,
  revisionEnrollmentLabel,
} from "../../src/courses/revisions-copy";

const revision = (overrides: Partial<CourseRevisionItemDto>): CourseRevisionItemDto => ({
  id: "id",
  number: 1,
  status: "PUBLISHED",
  locked: true,
  current: false,
  enrollmentCount: 0,
  publishedAt: null,
  createdAt: "2026-11-11T00:00:00.000Z",
  ...overrides,
});

describe("revisionEnrollmentLabel", () => {
  test("uses singular and plural", () => {
    expect(revisionEnrollmentLabel(1)).toBe("1 student");
    expect(revisionEnrollmentLabel(0)).toBe("0 students");
  });
});

describe("cloneRevisionFailedMessage", () => {
  test("explains the one draft rule", () => {
    expect(cloneRevisionFailedMessage("COURSE_REVISION_DRAFT_EXISTS")).toContain("draft");
    expect(cloneRevisionFailedMessage(undefined)).toBe(
      "The revision could not be cloned. Try again.",
    );
  });
});

describe("publishRevisionFailedMessage", () => {
  test("lists the failures", () => {
    expect(publishRevisionFailedMessage(["No quiz."])).toBe(
      "This revision is not ready to publish. No quiz.",
    );
    expect(publishRevisionFailedMessage([])).toContain("Try again");
  });
});

describe("canCloneRevisions and draftRevisionOf", () => {
  test("cloning needs every revision published", () => {
    expect(canCloneRevisions([revision({})])).toBe(true);
    expect(canCloneRevisions([revision({}), revision({ status: "DRAFT" })])).toBe(false);
    expect(canCloneRevisions([])).toBe(false);
  });

  test("finds the draft", () => {
    const draft = revision({ id: "d", status: "DRAFT" });
    expect(draftRevisionOf([revision({}), draft])).toBe(draft);
    expect(draftRevisionOf([revision({})])).toBeNull();
  });
});

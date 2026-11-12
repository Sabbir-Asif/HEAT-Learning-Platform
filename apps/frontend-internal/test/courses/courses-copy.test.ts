import { describe, expect, test } from "vitest";
import {
  courseDeleteBlockedMessage,
  publishBlockersTitle,
  publishFailedMessage,
} from "../../src/courses/courses-copy";
import { courseStatusFromUrl } from "../../src/courses/courses-status";

describe("courseDeleteBlockedMessage", () => {
  test("names the course and counts the enrollments", () => {
    expect(courseDeleteBlockedMessage("HEAT", 1)).toBe(
      "HEAT has 1 enrollment, so it cannot be deleted.",
    );
    expect(courseDeleteBlockedMessage("HEAT", 3)).toBe(
      "HEAT has 3 enrollments, so it cannot be deleted.",
    );
  });
});

describe("publishFailedMessage", () => {
  test("lists every failed check", () => {
    expect(publishFailedMessage("HEAT", ["Module 1 has no video.", "Module 2 has no quiz."])).toBe(
      "HEAT is not ready to publish. Module 1 has no video. Module 2 has no quiz.",
    );
  });

  test("falls back to a retry message without failures", () => {
    expect(publishFailedMessage("HEAT", [])).toBe("HEAT could not be published. Try again.");
  });
});

describe("publishBlockersTitle", () => {
  test("counts the blockers", () => {
    expect(publishBlockersTitle(1)).toBe("1 thing blocks publishing");
    expect(publishBlockersTitle(3)).toBe("3 things block publishing");
  });
});

describe("courseStatusFromUrl", () => {
  test("accepts known statuses and defaults to all", () => {
    expect(courseStatusFromUrl("draft")).toBe("draft");
    expect(courseStatusFromUrl("published")).toBe("published");
    expect(courseStatusFromUrl("bogus")).toBe("all");
    expect(courseStatusFromUrl(undefined)).toBe("all");
  });
});

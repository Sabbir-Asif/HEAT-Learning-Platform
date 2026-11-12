import { describe, expect, test } from "vitest";
import {
  frontPageReorderFailedMessage,
  tagDeleteDescription,
  tagUsagePhrase,
} from "../../src/tags/tags-copy";

describe("tagUsagePhrase", () => {
  test("counts courses and modules", () => {
    expect(tagUsagePhrase({ courses: [{}, {}], modules: [{}] })).toBe("2 courses and 1 module");
  });

  test("is empty when nothing uses the tag", () => {
    expect(tagUsagePhrase({ courses: [], modules: [] })).toBe("");
  });
});

describe("tagDeleteDescription", () => {
  test("names every course and module that loses the tag", () => {
    const text = tagDeleteDescription({
      courses: [{ title: "Foundations" }],
      modules: [{ title: "Consent", courseTitle: "Foundations" }],
    });
    expect(text).toContain("1 course and 1 module");
    expect(text).toContain("Foundations, Consent (Foundations)");
  });

  test("says so when the tag is unused", () => {
    expect(tagDeleteDescription({ courses: [], modules: [] })).toBe(
      "No course or module uses this tag.",
    );
  });
});

describe("frontPageReorderFailedMessage", () => {
  test("explains an order conflict", () => {
    expect(frontPageReorderFailedMessage("ORDER_CONFLICT")).toContain("Someone else");
  });

  test("falls back to a retry message", () => {
    expect(frontPageReorderFailedMessage(undefined)).toContain("Try again");
  });
});

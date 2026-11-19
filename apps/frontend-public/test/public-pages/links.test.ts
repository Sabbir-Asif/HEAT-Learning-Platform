import { describe, expect, test } from "vitest";
import { courseHref, descriptionParagraphs, enrollHref } from "../../src/public-pages/links";

describe("links", () => {
  test("deep-links the enroll page with the course slug", () => {
    expect(enrollHref("gender-safety")).toBe("/enroll?course=gender-safety");
    expect(enrollHref("a b")).toBe("/enroll?course=a%20b");
  });

  test("links the course overview by slug", () => {
    expect(courseHref("gender-safety")).toBe("/courses/gender-safety");
  });

  test("splits a description into trimmed paragraphs and drops empty ones", () => {
    expect(descriptionParagraphs("One\n\n  Two  \n\n\n\nThree")).toEqual(["One", "Two", "Three"]);
    expect(descriptionParagraphs(null)).toEqual([]);
    expect(descriptionParagraphs("  \n\n ")).toEqual([]);
  });
});

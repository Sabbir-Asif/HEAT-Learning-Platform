import { describe, expect, test } from "vitest";
import {
  courseCacheTag,
  frontPageCacheTag,
  isKnownCacheTag,
  landingCacheTag,
  revalidateMaxTags,
  revalidateRequestSchema,
} from "../src";

describe("public cache tags", () => {
  test("names one tag per course from its slug", () => {
    expect(courseCacheTag("gender-safety")).toBe("course:gender-safety");
  });

  test("knows the landing, front page and course tags", () => {
    expect(isKnownCacheTag(frontPageCacheTag)).toBe(true);
    expect(isKnownCacheTag(landingCacheTag)).toBe(true);
    expect(isKnownCacheTag("course:gender-safety")).toBe(true);
  });

  test("rejects any other tag", () => {
    expect(isKnownCacheTag("course:Bad Slug")).toBe(false);
    expect(isKnownCacheTag("course:")).toBe(false);
    expect(isKnownCacheTag("everything")).toBe(false);
  });
});

describe("revalidateRequestSchema", () => {
  test("accepts a list of known tags", () => {
    expect(revalidateRequestSchema.safeParse({ tags: ["front-page", "course:a"] }).success).toBe(
      true,
    );
  });

  test("rejects an empty list, unknown tags and oversized lists", () => {
    expect(revalidateRequestSchema.safeParse({ tags: [] }).success).toBe(false);
    expect(revalidateRequestSchema.safeParse({ tags: ["other"] }).success).toBe(false);
    const many = Array.from({ length: revalidateMaxTags + 1 }, () => "front-page");
    expect(revalidateRequestSchema.safeParse({ tags: many }).success).toBe(false);
  });
});

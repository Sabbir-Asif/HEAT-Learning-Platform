import { describe, expect, test } from "vitest";
import { createTagRequestSchema, setTagsRequestSchema, tagSlugOf } from "../src/index";

describe("tagSlugOf", () => {
  test("lowercases, strips accents and joins words with single hyphens", () => {
    expect(tagSlugOf("  Café   Safety & Care ")).toBe("cafe-safety-care");
  });

  test("returns an empty slug when nothing usable is left", () => {
    expect(tagSlugOf("!!!")).toBe("");
  });
});

describe("createTagRequestSchema", () => {
  test("normalises whitespace in the name", () => {
    expect(createTagRequestSchema.parse({ name: "  Core   skills " })).toEqual({
      name: "Core skills",
    });
  });

  test("rejects a blank name", () => {
    expect(createTagRequestSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  test("rejects a name without letters or digits", () => {
    expect(createTagRequestSchema.safeParse({ name: "---" }).success).toBe(false);
  });

  test("rejects a name over the limit", () => {
    expect(createTagRequestSchema.safeParse({ name: "a".repeat(61) }).success).toBe(false);
  });
});

describe("setTagsRequestSchema", () => {
  const id = "0198f1a0-0000-7000-8000-0000000000a1";

  test("accepts an empty list", () => {
    expect(setTagsRequestSchema.safeParse({ tagIds: [] }).success).toBe(true);
  });

  test("rejects a repeated tag", () => {
    expect(setTagsRequestSchema.safeParse({ tagIds: [id, id] }).success).toBe(false);
  });
});

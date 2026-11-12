import { describe, expect, test } from "vitest";
import {
  assertTagMutable,
  deletedTagSlug,
  denseOrder,
  nextDisplayOrder,
  planTagSet,
} from "../../src/catalog/tag-rules";
import { ApiException } from "../../src/http/api-exception";

describe("assertTagMutable", () => {
  test("refuses a system tag with TAG_RESERVED", () => {
    try {
      assertTagMutable({ isSystem: true });
      throw new Error("not refused");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiException);
      expect(error).toMatchObject({ code: "TAG_RESERVED" });
      expect((error as ApiException).getStatus()).toBe(409);
    }
  });

  test("allows an ordinary tag", () => {
    expect(() => assertTagMutable({ isSystem: false })).not.toThrow();
  });
});

describe("nextDisplayOrder", () => {
  test("starts at one and appends after the highest", () => {
    expect(nextDisplayOrder(null)).toBe(1);
    expect(nextDisplayOrder(4)).toBe(5);
  });
});

describe("planTagSet", () => {
  test("adds the new tags and removes the dropped ones", () => {
    expect(planTagSet(["a", "b"], ["b", "c"])).toEqual({ add: ["c"], remove: ["a"] });
  });

  test("changes nothing when the sets match", () => {
    expect(planTagSet(["a"], ["a"])).toEqual({ add: [], remove: [] });
  });
});

describe("denseOrder", () => {
  test("numbers the remaining items from one without gaps", () => {
    expect(denseOrder(["a", "c"])).toEqual([
      { id: "a", order: 1 },
      { id: "c", order: 2 },
    ]);
  });
});

describe("deletedTagSlug", () => {
  test("frees the slug for reuse", () => {
    expect(deletedTagSlug("core", "id1")).toBe("core~id1");
  });
});

import { describe, expect, test } from "vitest";
import {
  createUniversityRequestSchema,
  universityListQuerySchema,
  updateUniversityRequestSchema,
} from "../src/index";

describe("createUniversityRequestSchema", () => {
  test("trims the name and collapses inner whitespace", () => {
    expect(createUniversityRequestSchema.parse({ name: "  University   of  Dhaka " }).name).toBe(
      "University of Dhaka",
    );
  });

  test("rejects an empty or whitespace-only name", () => {
    expect(createUniversityRequestSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(createUniversityRequestSchema.safeParse({}).success).toBe(false);
  });

  test("rejects a name longer than 200 characters", () => {
    expect(createUniversityRequestSchema.safeParse({ name: "a".repeat(201) }).success).toBe(false);
    expect(createUniversityRequestSchema.safeParse({ name: "a".repeat(200) }).success).toBe(true);
  });
});

describe("updateUniversityRequestSchema", () => {
  test("uses the same rules as create", () => {
    expect(updateUniversityRequestSchema.parse({ name: " Dhaka " }).name).toBe("Dhaka");
    expect(updateUniversityRequestSchema.safeParse({ name: "" }).success).toBe(false);
  });
});

describe("universityListQuerySchema", () => {
  test("defaults the page and page size", () => {
    expect(universityListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 25 });
  });

  test("accepts a sort field and a search text", () => {
    expect(universityListQuerySchema.parse({ sort: "-name", q: " dha " })).toMatchObject({
      sort: "-name",
      q: "dha",
    });
  });

  test("rejects an unknown sort field and a page size that is not offered", () => {
    expect(universityListQuerySchema.safeParse({ sort: "id" }).success).toBe(false);
    expect(universityListQuerySchema.safeParse({ pageSize: 7 }).success).toBe(false);
  });
});

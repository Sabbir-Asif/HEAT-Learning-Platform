import { describe, expect, test } from "vitest";
import {
  createFacultyRequestSchema,
  createUniversityRequestSchema,
  facultyFormSchema,
  facultyListQuerySchema,
  facultyUniversityParamsSchema,
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

describe("createFacultyRequestSchema", () => {
  test("trims the name, collapses inner whitespace and asks for a faculty name", () => {
    expect(createFacultyRequestSchema.parse({ name: "  Faculty   of  Arts " }).name).toBe(
      "Faculty of Arts",
    );
    const empty = createFacultyRequestSchema.safeParse({ name: "  " });
    expect(empty.success ? "" : empty.error.issues[0]?.message).toBe("Enter the faculty name.");
  });

  test("rejects a name longer than 200 characters", () => {
    expect(createFacultyRequestSchema.safeParse({ name: "a".repeat(201) }).success).toBe(false);
    expect(createFacultyRequestSchema.safeParse({ name: "a".repeat(200) }).success).toBe(true);
  });
});

describe("facultyListQuerySchema", () => {
  const universityId = "0198f1a0-0000-7000-8000-000000000001";

  test("shares the university list parameters and adds a university filter", () => {
    expect(facultyListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 25 });
    expect(facultyListQuerySchema.parse({ universityId, sort: "-name" })).toMatchObject({
      universityId,
      sort: "-name",
    });
  });

  test("rejects a university filter that is not an id", () => {
    expect(facultyListQuerySchema.safeParse({ universityId: "dhaka" }).success).toBe(false);
  });
});

describe("facultyUniversityParamsSchema", () => {
  test("needs both ids", () => {
    const id = "0198f1a0-0000-7000-8000-000000000001";
    expect(facultyUniversityParamsSchema.safeParse({ id, universityId: id }).success).toBe(true);
    expect(facultyUniversityParamsSchema.safeParse({ id }).success).toBe(false);
  });
});

describe("facultyFormSchema", () => {
  test("keeps the name rules and carries the chosen university ids", () => {
    const id = "0198f1a0-0000-7000-8000-000000000001";
    expect(facultyFormSchema.parse({ name: " Arts ", universityIds: [id] })).toEqual({
      name: "Arts",
      universityIds: [id],
    });
    expect(facultyFormSchema.safeParse({ name: "", universityIds: [] }).success).toBe(false);
    expect(facultyFormSchema.safeParse({ name: "Arts", universityIds: ["x"] }).success).toBe(false);
  });
});

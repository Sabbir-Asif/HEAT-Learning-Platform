import { describe, expect, test } from "vitest";
import {
  createDepartmentRequestSchema,
  createFacultyRequestSchema,
  createUniversityRequestSchema,
  departmentListQuerySchema,
  directoryDepartmentLookupParamsSchema,
  directoryFacultyLookupParamsSchema,
  directoryOptionListResponseSchema,
  facultyFormSchema,
  facultyListQuerySchema,
  facultyUniversityParamsSchema,
  universityListQuerySchema,
  updateDepartmentRequestSchema,
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

const pair = {
  universityId: "0198f1a0-0000-7000-8000-000000000001",
  facultyId: "0198f1a0-0000-7000-8000-000000000002",
};

describe("createDepartmentRequestSchema", () => {
  test("trims the name and carries the university and faculty ids", () => {
    expect(createDepartmentRequestSchema.parse({ name: "  Computer   Science ", ...pair })).toEqual(
      {
        name: "Computer Science",
        ...pair,
      },
    );
  });

  test("rejects an empty name, a long name and ids that are not ids", () => {
    expect(createDepartmentRequestSchema.safeParse({ name: " ", ...pair }).success).toBe(false);
    expect(
      createDepartmentRequestSchema.safeParse({ name: "a".repeat(201), ...pair }).success,
    ).toBe(false);
    expect(
      createDepartmentRequestSchema.safeParse({ name: "CSE", ...pair, facultyId: "x" }).success,
    ).toBe(false);
    expect(createDepartmentRequestSchema.safeParse({ name: "CSE" }).success).toBe(false);
  });

  test("update uses the same rules", () => {
    expect(updateDepartmentRequestSchema.parse({ name: " CSE ", ...pair }).name).toBe("CSE");
  });
});

describe("departmentListQuerySchema", () => {
  test("defaults the page and accepts university and faculty filters", () => {
    expect(departmentListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 25 });
    expect(departmentListQuerySchema.parse({ ...pair, sort: "-name" })).toMatchObject({
      ...pair,
      sort: "-name",
    });
  });

  test("rejects filters that are not ids", () => {
    expect(departmentListQuerySchema.safeParse({ facultyId: "arts" }).success).toBe(false);
  });
});

describe("public directory lookups", () => {
  test("an option exposes only an id and a name", () => {
    const parsed = directoryOptionListResponseSchema.parse({
      items: [{ id: pair.universityId, name: "Dhaka", archivedAt: null, studentCount: 4 }],
    });

    expect(parsed).toEqual({ items: [{ id: pair.universityId, name: "Dhaka" }] });
  });

  test("lookup parameters must be ids", () => {
    expect(directoryFacultyLookupParamsSchema.safeParse({ universityId: "x" }).success).toBe(false);
    expect(
      directoryDepartmentLookupParamsSchema.safeParse({ ...pair, facultyId: "arts" }).success,
    ).toBe(false);
    expect(directoryDepartmentLookupParamsSchema.safeParse(pair).success).toBe(true);
  });
});

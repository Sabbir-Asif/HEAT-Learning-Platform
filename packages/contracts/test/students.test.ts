import { describe, expect, test } from "vitest";
import { studentListQuerySchema, studentSearchMaxLength } from "../src/index";

const id = "0192f2a0-7c1e-7b3a-8d4e-5f6a7b8c9d0e";

describe("studentListQuerySchema", () => {
  test("defaults to name order on page one", () => {
    expect(studentListQuerySchema.parse({})).toEqual({ sort: "name", page: 1, pageSize: 25 });
  });

  test("accepts every filter and coerces paging from the query string", () => {
    const parsed = studentListQuerySchema.parse({
      courseId: id,
      universityId: id,
      facultyId: id,
      departmentId: id,
      session: "2020-21",
      status: "APPROVED",
      q: "  anne ",
      sort: "-requestedAt",
      page: "3",
      pageSize: "50",
    });
    expect(parsed).toMatchObject({ status: "APPROVED", q: "anne", page: 3, pageSize: 50 });
  });

  test("treats a blank search as no search", () => {
    expect(studentListQuerySchema.parse({ q: "   " }).q).toBeUndefined();
  });

  test.each([
    { status: "ACTIVE" },
    { departmentId: "not-a-uuid" },
    { session: "2020-22" },
    { sort: "email" },
    { page: "0" },
    { pageSize: "7" },
    { q: "a".repeat(studentSearchMaxLength + 1) },
  ])("rejects %j", (input) => {
    expect(studentListQuerySchema.safeParse(input).success).toBe(false);
  });
});

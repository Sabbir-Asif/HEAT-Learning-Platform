import { describe, expect, test, vi } from "vitest";
import { StudentListService, studentWhere } from "../../src/enrollment/student-list.service";

const query = { sort: "name" as const, page: 2, pageSize: 25 };

describe("studentWhere", () => {
  test("always excludes soft-deleted enrollments and accounts", () => {
    expect(studentWhere(query)).toEqual({ deletedAt: null, user: { deletedAt: null } });
  });

  test("maps every filter onto the enrollment, course and profile", () => {
    expect(
      studentWhere({
        ...query,
        courseId: "course",
        universityId: "university",
        facultyId: "faculty",
        departmentId: "department",
        session: "2020-21",
        status: "APPROVED",
      }),
    ).toEqual({
      deletedAt: null,
      courseId: "course",
      status: "APPROVED",
      user: {
        deletedAt: null,
        profile: {
          is: {
            departmentId: "department",
            session: "2020-21",
            department: { universityId: "university", facultyId: "faculty" },
          },
        },
      },
    });
  });

  test("searches name and email case-insensitively", () => {
    expect(studentWhere({ ...query, q: "anne" })).toEqual({
      deletedAt: null,
      user: {
        deletedAt: null,
        OR: [
          { email: { contains: "anne", mode: "insensitive" } },
          { profile: { is: { name: { contains: "anne", mode: "insensitive" } } } },
        ],
      },
    });
  });
});

describe("StudentListService.list", () => {
  const row = {
    id: "enrollment-id",
    status: "APPROVED",
    requestedAt: new Date("2026-11-02T03:00:00.000Z"),
    userId: "user-id",
    course: { id: "course-id", title: "HEAT" },
    user: {
      email: "anne@example.com",
      profile: {
        name: "Anne Smith",
        session: "2020-21",
        department: {
          id: "department-id",
          name: "Law",
          universityFaculty: {
            university: { id: "university-id", name: "University of Dhaka" },
            faculty: { id: "faculty-id", name: "Faculty of Law" },
          },
        },
      },
    },
  };

  test("returns a page of students with the total", async () => {
    const database = {
      enrollment: {
        findMany: vi.fn().mockResolvedValue([row]),
        count: vi.fn().mockResolvedValue(51),
      },
    };

    const result = await new StudentListService(database as never).list(query);

    expect(database.enrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ user: { profile: { name: "asc" } } }, { id: "asc" }],
        skip: 25,
        take: 25,
      }),
    );
    expect(result).toEqual({
      items: [
        {
          id: "enrollment-id",
          status: "APPROVED",
          requestedAt: "2026-11-02T03:00:00.000Z",
          student: { userId: "user-id", name: "Anne Smith", email: "anne@example.com" },
          course: { id: "course-id", title: "HEAT" },
          university: { id: "university-id", name: "University of Dhaka" },
          faculty: { id: "faculty-id", name: "Faculty of Law" },
          department: { id: "department-id", name: "Law" },
          session: "2020-21",
        },
      ],
      total: 51,
      page: 2,
      pageSize: 25,
    });
  });

  test.each([
    ["-name", [{ user: { profile: { name: "desc" } } }, { id: "asc" }]],
    ["requestedAt", [{ requestedAt: "asc" }, { id: "asc" }]],
    ["-requestedAt", [{ requestedAt: "desc" }, { id: "asc" }]],
  ] as const)("orders by %s", async (sort, orderBy) => {
    const database = {
      enrollment: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    };

    await new StudentListService(database as never).list({ ...query, sort });

    expect(database.enrollment.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy }));
  });
});

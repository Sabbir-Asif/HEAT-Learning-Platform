import { describe, expect, test, vi } from "vitest";
import { StudentDetailService } from "../../src/enrollment/student-detail.service";

const build = (user: unknown) => {
  const database = {
    user: { findFirst: vi.fn().mockResolvedValue(user) },
    enrollment: { findMany: vi.fn().mockResolvedValue([]) },
    module: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const service = new StudentDetailService(database as never, {
    publicAppUrl: "https://heat.example",
  } as never);
  return { database, service };
};

describe("StudentDetailService.get", () => {
  test("looks up only live student accounts with a live profile", async () => {
    const { database, service } = build(null);

    await expect(service.get("user-id")).rejects.toMatchObject({ status: 404 });

    expect(database.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "user-id",
          realm: "STUDENT",
          deletedAt: null,
          profile: { is: { deletedAt: null } },
        },
      }),
    );
    expect(database.enrollment.findMany).not.toHaveBeenCalled();
  });

  test("returns the profile with no enrollments", async () => {
    const { service } = build({
      id: "user-id",
      email: "anne@example.com",
      profile: {
        name: "Anne",
        session: "2020-21",
        department: {
          id: "d",
          name: "Law",
          universityFaculty: {
            university: { id: "u", name: "U" },
            faculty: { id: "f", name: "F" },
          },
        },
      },
    });

    await expect(service.get("user-id")).resolves.toMatchObject({
      name: "Anne",
      enrollments: [],
    });
  });
});

import { describe, expect, test, vi } from "vitest";
import { ApprovalQueueService, queueWhere } from "../../src/enrollment/approval-queue.service";

const query = {
  sort: "requestedAt" as const,
  page: 2,
  pageSize: 25,
};

describe("queueWhere", () => {
  test("always limits to live pending approvals of live students", () => {
    expect(queueWhere(query)).toEqual({
      status: "PENDING_APPROVAL",
      deletedAt: null,
      user: { deletedAt: null },
    });
  });

  test("maps every filter onto the enrollment, course and profile", () => {
    const where = queueWhere({
      ...query,
      courseId: "course",
      universityId: "university",
      facultyId: "faculty",
      departmentId: "department",
      session: "2020-21",
      submittedFrom: "2026-11-01",
      submittedTo: "2026-11-30",
    });

    expect(where).toEqual({
      status: "PENDING_APPROVAL",
      deletedAt: null,
      courseId: "course",
      requestedAt: {
        gte: new Date("2026-11-01T00:00:00+06:00"),
        lt: new Date("2026-12-01T00:00:00+06:00"),
      },
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
});

describe("ApprovalQueueService.list", () => {
  const row = {
    id: "enrollment-id",
    requestedAt: new Date("2026-11-02T03:00:00.000Z"),
    verifiedAt: new Date("2026-11-02T04:00:00.000Z"),
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

  test("returns oldest first by default with the total", async () => {
    const database = {
      enrollment: {
        findMany: vi.fn().mockResolvedValue([row]),
        count: vi.fn().mockResolvedValue(51),
      },
    };
    const service = new ApprovalQueueService(database as never);

    const result = await service.list(query);

    expect(database.enrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ requestedAt: "asc" }, { id: "asc" }],
        skip: 25,
        take: 25,
      }),
    );
    expect(result).toEqual({
      items: [
        {
          id: "enrollment-id",
          requestedAt: "2026-11-02T03:00:00.000Z",
          verifiedAt: "2026-11-02T04:00:00.000Z",
          student: { name: "Anne Smith", email: "anne@example.com" },
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

  test("sorts newest first on request", async () => {
    const database = {
      enrollment: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    };

    await new ApprovalQueueService(database as never).list({ ...query, sort: "-requestedAt" });

    expect(database.enrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ requestedAt: "desc" }, { id: "asc" }] }),
    );
  });
});

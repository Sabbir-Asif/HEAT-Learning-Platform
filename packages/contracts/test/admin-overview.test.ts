import { describe, expect, test } from "vitest";
import {
  adminOverviewQuerySchema,
  adminOverviewSchema,
  adminOverviewStatusOrder,
  enrollmentStatuses,
} from "../src/index";

describe("adminOverviewQuerySchema", () => {
  test("accepts no course and one course id", () => {
    expect(adminOverviewQuerySchema.parse({})).toEqual({});
    const courseId = "0198b3f0-0000-7000-8000-000000000001";
    expect(adminOverviewQuerySchema.parse({ courseId })).toEqual({ courseId });
  });

  test("rejects a course id that is not a uuid", () => {
    expect(adminOverviewQuerySchema.safeParse({ courseId: "x" }).success).toBe(false);
  });
});

describe("adminOverviewSchema", () => {
  test("accepts an overview with a withheld pass rate", () => {
    const overview = {
      statusCounts: enrollmentStatuses.map((status) => ({ status, count: 0 })),
      totalEnrollments: 0,
      pending: { count: 0, oldestRequestedAt: null, oldestAgeSeconds: null },
      certificatesIssued: 0,
      passRates: [
        { moduleId: "m", label: "Module 1", suppressed: true, students: null, passRate: null },
      ],
      suppressionThreshold: 5,
      refreshedAt: null,
    };
    expect(adminOverviewSchema.parse(overview)).toEqual(overview);
  });

  test("lists the statuses in the order the dashboard shows them", () => {
    expect(adminOverviewStatusOrder[0]).toBe("PENDING_VERIFICATION");
  });
});

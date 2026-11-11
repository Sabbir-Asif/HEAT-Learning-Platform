import { describe, expect, test } from "vitest";
import { dashboardCourseSchema, dashboardResponseSchema } from "../src";

const id = "0198f1a0-0000-7000-8000-0000000000a1";

const course = {
  courseId: id,
  courseSlug: "heat",
  courseTitle: "HEAT",
  status: "APPROVED",
  reason: null,
  progress: { modulesCompleted: 1, modulesTotal: 4, percent: 25 },
  nextModule: { id, order: 2, title: "Module 2", resumeVideoId: id, resumePositionSeconds: 42 },
  certificateNumber: null,
};

describe("dashboardResponseSchema", () => {
  test("accepts an in-progress course with a resume position", () => {
    expect(dashboardResponseSchema.parse({ courses: [course] }).courses[0]?.nextModule?.order).toBe(
      2,
    );
  });

  test("accepts a pending course with status only", () => {
    expect(
      dashboardCourseSchema.safeParse({
        ...course,
        status: "PENDING_APPROVAL",
        progress: null,
        nextModule: null,
      }).success,
    ).toBe(true);
  });

  test("rejects a percent above 100 and an unknown status", () => {
    expect(
      dashboardCourseSchema.safeParse({
        ...course,
        progress: { modulesCompleted: 1, modulesTotal: 1, percent: 101 },
      }).success,
    ).toBe(false);
    expect(dashboardCourseSchema.safeParse({ ...course, status: "UNKNOWN" }).success).toBe(false);
  });

  test("rejects a negative resume position", () => {
    expect(
      dashboardCourseSchema.safeParse({
        ...course,
        nextModule: { ...course.nextModule, resumePositionSeconds: -1 },
      }).success,
    ).toBe(false);
  });
});

import type { DashboardCourse } from "@heat/contracts";
import { describe, expect, test } from "vitest";
import {
  continueTargetOf,
  dashboardRedirectPath,
  formatResumePosition,
  groupDashboardCourses,
} from "../../src/dashboard/dashboard-view";

const id = "0198f1a0-0000-7000-8000-0000000000a1";

const course = (overrides: Partial<DashboardCourse> = {}): DashboardCourse => ({
  courseId: id,
  courseSlug: "heat",
  courseTitle: "HEAT",
  thumbnail: null,
  status: "APPROVED",
  reason: null,
  progress: { modulesCompleted: 1, modulesTotal: 4, percent: 25 },
  nextModule: { id, order: 2, title: "Module 2", resumeVideoId: null, resumePositionSeconds: 0 },
  certificate: null,
  ...overrides,
});

describe("groupDashboardCourses", () => {
  test("puts each course under its own group in a fixed order", () => {
    const groups = groupDashboardCourses([
      course({ status: "PENDING_APPROVAL" }),
      course({ status: "COMPLETED" }),
      course({ status: "REMOVED", reason: "Left" }),
      course({ status: "APPROVED" }),
      course({ status: "PENDING_VERIFICATION" }),
    ]);

    expect(groups.map((group) => [group.key, group.courses.length])).toEqual([
      ["inProgress", 1],
      ["completed", 1],
      ["pending", 2],
      ["removed", 1],
    ]);
  });

  test("leaves empty groups out", () => {
    expect(groupDashboardCourses([])).toEqual([]);
    expect(groupDashboardCourses([course()]).map((group) => group.key)).toEqual(["inProgress"]);
  });

  test("closed requests sit with removed courses", () => {
    const groups = groupDashboardCourses([
      course({ status: "REJECTED" }),
      course({ status: "EXPIRED" }),
    ]);

    expect(groups.map((group) => group.key)).toEqual(["removed"]);
  });
});

describe("dashboardRedirectPath", () => {
  test("stays when a course is in progress or completed", () => {
    expect(dashboardRedirectPath([course()])).toBeNull();
    expect(dashboardRedirectPath([course({ status: "COMPLETED" })])).toBeNull();
    expect(
      dashboardRedirectPath([
        course({ status: "PENDING_APPROVAL" }),
        course({ status: "APPROVED" }),
      ]),
    ).toBeNull();
  });

  test("sends a student with only pending enrollments to awaiting approval", () => {
    expect(dashboardRedirectPath([course({ status: "PENDING_APPROVAL" })])).toBe(
      "/awaiting-approval",
    );
    expect(dashboardRedirectPath([course({ status: "PENDING_VERIFICATION" })])).toBe(
      "/awaiting-approval",
    );
  });

  test("sends a student with no enrollments or only closed requests to awaiting approval", () => {
    expect(dashboardRedirectPath([])).toBe("/awaiting-approval");
    expect(dashboardRedirectPath([course({ status: "REJECTED" })])).toBe("/awaiting-approval");
  });

  test("keeps a student with only removed courses on the dashboard", () => {
    expect(dashboardRedirectPath([course({ status: "REMOVED", reason: "Left" })])).toBeNull();
  });
});

describe("continueTargetOf", () => {
  test("links to the next module with no resume hint when nothing was watched", () => {
    expect(continueTargetOf(course())).toEqual({
      href: `/learn/heat/${id}`,
      moduleLabel: "Module 2: Module 2",
      resumeHint: null,
    });
  });

  test("adds a resume hint from the saved position", () => {
    const target = continueTargetOf(
      course({
        nextModule: { id, order: 2, title: "Intro", resumeVideoId: id, resumePositionSeconds: 125 },
      }),
    );

    expect(target?.resumeHint).toBe("Resume at 2:05");
  });

  test("gives no target for removed, completed, pending or finished courses", () => {
    expect(continueTargetOf(course({ status: "REMOVED", nextModule: null }))).toBeNull();
    expect(continueTargetOf(course({ status: "COMPLETED", nextModule: null }))).toBeNull();
    expect(continueTargetOf(course({ status: "PENDING_APPROVAL", nextModule: null }))).toBeNull();
    expect(continueTargetOf(course({ nextModule: null }))).toBeNull();
  });

  test("encodes the course slug", () => {
    expect(continueTargetOf(course({ courseSlug: "a b" }))?.href).toBe(`/learn/a%20b/${id}`);
  });
});

describe("formatResumePosition", () => {
  test.each([
    [0, "0:00"],
    [9, "0:09"],
    [60, "1:00"],
    [3725, "62:05"],
    [-4, "0:00"],
  ])("%d seconds is %s", (seconds, text) => {
    expect(formatResumePosition(seconds)).toBe(text);
  });
});

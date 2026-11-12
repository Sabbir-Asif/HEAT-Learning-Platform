import { describe, expect, test } from "vitest";
import {
  coveragePercent,
  meetsVideoThreshold,
  toStudentDetail,
} from "../../src/enrollment/student-detail-rules";
import type {
  StudentDetailEnrollmentRow,
  StudentDetailUserRow,
} from "../../src/enrollment/student-detail-rules";

const user: StudentDetailUserRow = {
  id: "user-id",
  email: "anne@example.com",
  profile: {
    name: "Anne",
    session: "2020-21",
    department: {
      id: "department-id",
      name: "Law",
      universityFaculty: {
        university: { id: "university-id", name: "Dhaka" },
        faculty: { id: "faculty-id", name: "Law faculty" },
      },
    },
  },
};

const enrollment = (
  overrides: Partial<StudentDetailEnrollmentRow> = {},
): StudentDetailEnrollmentRow => ({
  id: "enrollment-id",
  status: "APPROVED",
  requestedAt: new Date("2026-11-01T00:00:00.000Z"),
  approvedAt: new Date("2026-11-02T00:00:00.000Z"),
  completedAt: null,
  course: { id: "course-id", title: "HEAT" },
  decisions: [
    {
      id: "decision-id",
      action: "APPROVE",
      reason: null,
      decidedAt: new Date("2026-11-02T00:00:00.000Z"),
      admin: { id: "admin-id", email: "admin@example.com" },
    },
  ],
  certificate: null,
  videoProgress: [
    { videoId: "v1", coverage: 0.804, completedAt: null },
    { videoId: "v2", coverage: 0.79, completedAt: null },
  ],
  moduleProgress: [{ moduleId: "m1", status: "QUIZ_READY", completedAt: null }],
  quizAttempts: [
    {
      id: "late",
      quizId: "q1",
      startedAt: new Date("2026-11-04T00:00:00.000Z"),
      submittedAt: new Date("2026-11-04T00:10:00.000Z"),
      scorePercent: 80,
      passMarkSnapshot: 70,
      passed: true,
    },
    {
      id: "early",
      quizId: "q1",
      startedAt: new Date("2026-11-03T00:00:00.000Z"),
      submittedAt: new Date("2026-11-03T00:10:00.000Z"),
      scorePercent: 60,
      passMarkSnapshot: 90,
      passed: false,
    },
  ],
  revisionModules: [
    { id: "m2", order: 2, title: "Second", videos: [], quiz: null },
    {
      id: "m1",
      order: 1,
      title: "First",
      videos: [
        { id: "v2", order: 2, title: "Two", required: true },
        { id: "v1", order: 1, title: "One", required: true },
      ],
      quiz: { id: "q1" },
    },
  ],
  ...overrides,
});

describe("video coverage", () => {
  test("rounds to a whole percentage inside 0 to 100", () => {
    expect(coveragePercent(0.804)).toBe(80);
    expect(coveragePercent(1.4)).toBe(100);
    expect(coveragePercent(-1)).toBe(0);
  });

  test("meets the threshold at 80 percent or when completed", () => {
    expect(meetsVideoThreshold({ coverage: 0.8, completedAt: null })).toBe(true);
    expect(meetsVideoThreshold({ coverage: 0.79, completedAt: null })).toBe(false);
    expect(meetsVideoThreshold({ coverage: 0.1, completedAt: new Date() })).toBe(true);
  });
});

describe("toStudentDetail", () => {
  test("refuses a user without a profile", () => {
    expect(toStudentDetail({ ...user, profile: null }, [], "https://heat.example")).toBeNull();
  });

  test("orders modules, videos and attempts and keeps each attempt's own pass mark", () => {
    const detail = toStudentDetail(user, [enrollment()], "https://heat.example");
    const modules = detail?.enrollments[0]?.modules ?? [];

    expect(modules.map((module) => module.title)).toEqual(["First", "Second"]);
    expect(modules[0]?.status).toBe("QUIZ_READY");
    expect(modules[1]?.status).toBe("LOCKED");
    expect(
      modules[0]?.videos.map((video) => [video.title, video.coveragePercent, video.meetsThreshold]),
    ).toEqual([
      ["One", 80, true],
      ["Two", 79, false],
    ]);
    expect(
      modules[0]?.quizAttempts.map((attempt) => [
        attempt.id,
        attempt.passMarkSnapshot,
        attempt.passed,
      ]),
    ).toEqual([
      ["early", 90, false],
      ["late", 70, true],
    ]);
  });

  test("an unwatched video shows zero coverage", () => {
    const detail = toStudentDetail(
      user,
      [enrollment({ videoProgress: [] })],
      "https://heat.example",
    );

    expect(detail?.enrollments[0]?.modules[0]?.videos[0]).toMatchObject({
      coveragePercent: 0,
      meetsThreshold: false,
    });
  });

  test("links an issued certificate to the public verification page", () => {
    const detail = toStudentDetail(
      user,
      [
        enrollment({
          certificate: {
            id: "certificate-id",
            number: "ABC123",
            fileKey: `${"a".repeat(64)}.pdf`,
            revokedAt: null,
            issuedAt: new Date("2026-11-05T00:00:00.000Z"),
          },
        }),
      ],
      "https://heat.example/app",
    );

    expect(detail?.enrollments[0]?.certificate).toEqual({
      id: "certificate-id",
      number: "ABC123",
      status: "READY",
      issuedAt: "2026-11-05T00:00:00.000Z",
      verificationUrl: "https://heat.example/verify/ABC123",
    });
  });

  test("reports a revoked certificate and the decision history with its admin", () => {
    const detail = toStudentDetail(
      user,
      [
        enrollment({
          certificate: {
            id: "certificate-id",
            number: "ABC123",
            fileKey: null,
            revokedAt: new Date(),
            issuedAt: new Date("2026-11-05T00:00:00.000Z"),
          },
        }),
      ],
      "https://heat.example",
    );

    expect(detail?.enrollments[0]?.certificate?.status).toBe("REVOKED");
    expect(detail?.enrollments[0]?.decisions[0]).toMatchObject({
      action: "APPROVE",
      admin: { email: "admin@example.com" },
    });
  });
});

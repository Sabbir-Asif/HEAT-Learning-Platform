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

const now = new Date("2026-11-12T10:00:00.000Z");

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
  attemptGrants: [],
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
      quiz: { id: "q1", attemptLimit: 2, waitMinutes: 10 },
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
    expect(toStudentDetail({ ...user, profile: null }, [], "https://heat.example", now)).toBeNull();
  });

  test("orders modules, videos and attempts and keeps each attempt's own pass mark", () => {
    const detail = toStudentDetail(user, [enrollment()], "https://heat.example", now);
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
      now,
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
      now,
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
      now,
    );

    expect(detail?.enrollments[0]?.certificate?.status).toBe("REVOKED");
    expect(detail?.enrollments[0]?.decisions[0]).toMatchObject({
      action: "APPROVE",
      admin: { email: "admin@example.com" },
    });
  });
});

describe("toStudentDetail quiz grants", () => {
  const modulesOf = (overrides: Partial<StudentDetailEnrollmentRow>) =>
    toStudentDetail(user, [enrollment(overrides)], "https://heat.example", now)?.enrollments[0]
      ?.modules ?? [];

  const failedAttempt = (id: string, hour: number) => ({
    id,
    quizId: "q1",
    startedAt: new Date(`2026-11-04T0${hour}:00:00.000Z`),
    submittedAt: new Date(`2026-11-04T0${hour}:10:00.000Z`),
    scorePercent: 10,
    passMarkSnapshot: 70,
    passed: false,
  });

  test("reports the limit, the granted total and that a grant is possible once the limit is used up", () => {
    const [first, second] = modulesOf({
      quizAttempts: [failedAttempt("a", 1), failedAttempt("b", 2)],
      attemptGrants: [
        { quizId: "q1", extraAttempts: 0 },
        { quizId: "other", extraAttempts: 5 },
      ],
    });

    expect(first?.quiz).toEqual({
      id: "q1",
      attemptLimit: 2,
      grantedAttempts: 0,
      canGrantAttempt: true,
    });
    expect(second?.quiz).toBeNull();
  });

  test("adds up grants and no longer offers one while a granted attempt is unused", () => {
    const [first] = modulesOf({
      quizAttempts: [failedAttempt("a", 1), failedAttempt("b", 2)],
      attemptGrants: [
        { quizId: "q1", extraAttempts: 1 },
        { quizId: "q1", extraAttempts: 1 },
      ],
    });

    expect(first?.quiz).toMatchObject({ grantedAttempts: 2, canGrantAttempt: false });
  });

  test("does not count an attempt that was never submitted", () => {
    const open = { ...failedAttempt("a", 1), submittedAt: null, passed: null };
    const [first] = modulesOf({ quizAttempts: [open, failedAttempt("b", 2)] });

    expect(first?.quiz?.canGrantAttempt).toBe(false);
  });

  test("offers no grant on an approved enrollment's unlimited quiz or a removed enrollment", () => {
    const unlimited = modulesOf({
      revisionModules: [
        {
          id: "m1",
          order: 1,
          title: "First",
          videos: [],
          quiz: { id: "q1", attemptLimit: null, waitMinutes: 10 },
        },
      ],
    });
    const removed = modulesOf({
      status: "REMOVED",
      quizAttempts: [failedAttempt("a", 1), failedAttempt("b", 2)],
    });

    expect(unlimited[0]?.quiz?.canGrantAttempt).toBe(false);
    expect(removed[0]?.quiz?.canGrantAttempt).toBe(false);
  });
});

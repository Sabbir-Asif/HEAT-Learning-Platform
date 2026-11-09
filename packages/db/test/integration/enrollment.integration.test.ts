import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { withDatabase, type TestDatabase } from "./helpers";

let database: TestDatabase;

beforeAll(async () => {
  database = await withDatabase();
});

afterAll(async () => {
  await database.close();
});

const unique = () => Math.random().toString(36).slice(2);

const createStudent = () =>
  database.prisma.user.create({
    data: {
      email: `${unique()}@example.com`,
      passwordHash: "argon2id-hash",
      role: "STUDENT",
      realm: "STUDENT",
    },
  });

const createAdmin = () =>
  database.prisma.user.create({
    data: {
      email: `${unique()}@example.com`,
      passwordHash: "argon2id-hash",
      role: "ADMIN",
      realm: "ADMIN",
    },
  });

const createCourse = async () => {
  const course = await database.prisma.course.create({
    data: { slug: `course-${unique()}`, title: "Gender safety" },
  });
  const revision = await database.prisma.courseRevision.create({
    data: { courseId: course.id, number: 1 },
  });
  return { course, revision };
};

describe("one enrollment per student and course", () => {
  test("a second enrollment for the same pair is rejected", async () => {
    const student = await createStudent();
    const { course } = await createCourse();
    const data = { userId: student.id, courseId: course.id };
    await database.prisma.enrollment.create({ data });

    await expect(database.prisma.enrollment.create({ data })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  test("the same student can enroll in a different course", async () => {
    const student = await createStudent();
    const first = await createCourse();
    const second = await createCourse();
    await database.prisma.enrollment.create({
      data: { userId: student.id, courseId: first.course.id },
    });

    const enrollment = await database.prisma.enrollment.create({
      data: { userId: student.id, courseId: second.course.id },
    });

    expect(enrollment.courseId).toBe(second.course.id);
  });

  test("a new enrollment waits for verification and records when it was requested", async () => {
    const student = await createStudent();
    const { course } = await createCourse();

    const enrollment = await database.prisma.enrollment.create({
      data: { userId: student.id, courseId: course.id },
    });

    expect(enrollment.status).toBe("PENDING_VERIFICATION");
    expect(enrollment.requestedAt).toBeInstanceOf(Date);
    expect(enrollment.courseRevisionId).toBeNull();
  });
});

describe("pinning to a revision", () => {
  test.each(["APPROVED", "COMPLETED"] as const)(
    "%s without a pinned revision is rejected",
    async (status) => {
      const student = await createStudent();
      const { course } = await createCourse();

      await expect(
        database.prisma.enrollment.create({
          data: { userId: student.id, courseId: course.id, status },
        }),
      ).rejects.toThrow(/check|constraint/i);
    },
  );

  test("APPROVED with a pinned revision is accepted", async () => {
    const student = await createStudent();
    const { course, revision } = await createCourse();

    const enrollment = await database.prisma.enrollment.create({
      data: {
        userId: student.id,
        courseId: course.id,
        courseRevisionId: revision.id,
        status: "APPROVED",
        approvedAt: new Date(),
      },
    });

    expect(enrollment.courseRevisionId).toBe(revision.id);
  });

  test("a revision of another course cannot be pinned", async () => {
    const student = await createStudent();
    const { course } = await createCourse();
    const other = await createCourse();

    await expect(
      database.prisma.enrollment.create({
        data: {
          userId: student.id,
          courseId: course.id,
          courseRevisionId: other.revision.id,
          status: "APPROVED",
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });
});

describe("removal remembers the previous state", () => {
  test("REMOVED without a previous state is rejected", async () => {
    const student = await createStudent();
    const { course, revision } = await createCourse();

    await expect(
      database.prisma.enrollment.create({
        data: {
          userId: student.id,
          courseId: course.id,
          courseRevisionId: revision.id,
          status: "REMOVED",
        },
      }),
    ).rejects.toThrow(/check|constraint/i);
  });

  test("a previous state on an enrollment that is not removed is rejected", async () => {
    const student = await createStudent();
    const { course } = await createCourse();

    await expect(
      database.prisma.enrollment.create({
        data: {
          userId: student.id,
          courseId: course.id,
          status: "PENDING_APPROVAL",
          statusBeforeRemoval: "APPROVED",
        },
      }),
    ).rejects.toThrow(/check|constraint/i);
  });

  test("REMOVED with the previous state is accepted", async () => {
    const student = await createStudent();
    const { course, revision } = await createCourse();

    const enrollment = await database.prisma.enrollment.create({
      data: {
        userId: student.id,
        courseId: course.id,
        courseRevisionId: revision.id,
        status: "REMOVED",
        statusBeforeRemoval: "APPROVED",
        removedAt: new Date(),
      },
    });

    expect(enrollment.statusBeforeRemoval).toBe("APPROVED");
  });
});

describe("decisions", () => {
  test("every decision names an admin and keeps its reason", async () => {
    const student = await createStudent();
    const admin = await createAdmin();
    const { course } = await createCourse();
    const enrollment = await database.prisma.enrollment.create({
      data: { userId: student.id, courseId: course.id, status: "PENDING_APPROVAL" },
    });

    const decision = await database.prisma.enrollmentDecision.create({
      data: {
        enrollmentId: enrollment.id,
        adminId: admin.id,
        action: "REJECT",
        reason: "Not a student of the university",
      },
    });

    expect(decision.decidedAt).toBeInstanceOf(Date);
    expect(decision.reason).toBe("Not a student of the university");
  });

  test("an enrollment keeps every decision made about it", async () => {
    const student = await createStudent();
    const admin = await createAdmin();
    const { course, revision } = await createCourse();
    const enrollment = await database.prisma.enrollment.create({
      data: {
        userId: student.id,
        courseId: course.id,
        courseRevisionId: revision.id,
        status: "APPROVED",
      },
    });
    for (const action of ["APPROVE", "REMOVE", "REINSTATE"] as const) {
      await database.prisma.enrollmentDecision.create({
        data: { enrollmentId: enrollment.id, adminId: admin.id, action },
      });
    }

    expect(
      await database.prisma.enrollmentDecision.count({ where: { enrollmentId: enrollment.id } }),
    ).toBe(3);
  });

  test("a decision needs an existing admin", async () => {
    const student = await createStudent();
    const { course } = await createCourse();
    const enrollment = await database.prisma.enrollment.create({
      data: { userId: student.id, courseId: course.id },
    });

    await expect(
      database.prisma.enrollmentDecision.create({
        data: { enrollmentId: enrollment.id, adminId: crypto.randomUUID(), action: "APPROVE" },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });
});

describe("history cannot be deleted from under an enrollment", () => {
  test("a student with an enrollment cannot be hard deleted", async () => {
    const student = await createStudent();
    const { course } = await createCourse();
    await database.prisma.enrollment.create({ data: { userId: student.id, courseId: course.id } });

    await expect(database.prisma.user.delete({ where: { id: student.id } })).rejects.toMatchObject({
      code: "P2003",
    });
  });

  test("a course with an enrollment cannot be hard deleted", async () => {
    const student = await createStudent();
    const { course } = await createCourse();
    await database.prisma.enrollment.create({ data: { userId: student.id, courseId: course.id } });

    await expect(database.prisma.course.delete({ where: { id: course.id } })).rejects.toMatchObject(
      { code: "P2003" },
    );
  });

  test("a revision pinned by an enrollment cannot be hard deleted", async () => {
    const student = await createStudent();
    const { course, revision } = await createCourse();
    await database.prisma.enrollment.create({
      data: {
        userId: student.id,
        courseId: course.id,
        courseRevisionId: revision.id,
        status: "APPROVED",
      },
    });

    await expect(
      database.prisma.courseRevision.delete({ where: { id: revision.id } }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  test("an admin who decided an enrollment cannot be hard deleted", async () => {
    const student = await createStudent();
    const admin = await createAdmin();
    const { course } = await createCourse();
    const enrollment = await database.prisma.enrollment.create({
      data: { userId: student.id, courseId: course.id },
    });
    await database.prisma.enrollmentDecision.create({
      data: { enrollmentId: enrollment.id, adminId: admin.id, action: "APPROVE" },
    });

    await expect(database.prisma.user.delete({ where: { id: admin.id } })).rejects.toMatchObject({
      code: "P2003",
    });
  });
});

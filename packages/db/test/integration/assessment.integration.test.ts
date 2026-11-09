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

const createQuizWorld = async () => {
  const student = await database.prisma.user.create({
    data: {
      email: `${unique()}@example.com`,
      passwordHash: "argon2id-hash",
      role: "STUDENT",
      realm: "STUDENT",
    },
  });
  const admin = await database.prisma.user.create({
    data: {
      email: `${unique()}@example.com`,
      passwordHash: "argon2id-hash",
      role: "ADMIN",
      realm: "ADMIN",
    },
  });
  const course = await database.prisma.course.create({
    data: { slug: `course-${unique()}`, title: "Gender safety" },
  });
  const revision = await database.prisma.courseRevision.create({
    data: { courseId: course.id, number: 1 },
  });
  const module = await database.prisma.module.create({
    data: { revisionId: revision.id, order: 1, title: "Module one" },
  });
  const quiz = await database.prisma.quiz.create({ data: { moduleId: module.id } });
  const enrollment = await database.prisma.enrollment.create({
    data: {
      userId: student.id,
      courseId: course.id,
      courseRevisionId: revision.id,
      status: "APPROVED",
    },
  });
  return { student, admin, module, quiz, enrollment };
};

const addQuestion = async (quizId: string, order = 1) => {
  const question = await database.prisma.question.create({
    data: { quizId, order, text: "Which is right?", explanation: "Because." },
  });
  const right = await database.prisma.option.create({
    data: { questionId: question.id, order: 1, text: "Right", isCorrect: true },
  });
  const wrong = await database.prisma.option.create({
    data: { questionId: question.id, order: 2, text: "Wrong" },
  });
  return { question, right, wrong };
};

describe("quiz defaults", () => {
  test("a quiz with no explicit rules passes at 70 percent, has no attempt limit and waits 10 minutes", async () => {
    const { quiz } = await createQuizWorld();

    expect(quiz.passMarkPercent).toBe(70);
    expect(quiz.attemptLimit).toBeNull();
    expect(quiz.waitMinutes).toBe(10);
  });

  test("a module has one quiz", async () => {
    const { module } = await createQuizWorld();

    await expect(
      database.prisma.quiz.create({ data: { moduleId: module.id } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  test.each([-1, 101])("pass mark %s is rejected", async (passMarkPercent) => {
    const { quiz } = await createQuizWorld();

    await expect(
      database.prisma.quiz.update({ where: { id: quiz.id }, data: { passMarkPercent } }),
    ).rejects.toThrow(/Quiz_passMarkPercent_check/);
  });

  test("an attempt limit of zero is rejected", async () => {
    const { quiz } = await createQuizWorld();

    await expect(
      database.prisma.quiz.update({ where: { id: quiz.id }, data: { attemptLimit: 0 } }),
    ).rejects.toThrow(/Quiz_attemptLimit_check/);
  });

  test("a negative wait time is rejected", async () => {
    const { quiz } = await createQuizWorld();

    await expect(
      database.prisma.quiz.update({ where: { id: quiz.id }, data: { waitMinutes: -1 } }),
    ).rejects.toThrow(/Quiz_waitMinutes_check/);
  });
});

describe("questions and options", () => {
  test("a question defaults to single choice and keeps its explanation", async () => {
    const { quiz } = await createQuizWorld();

    const { question } = await addQuestion(quiz.id);

    expect(question.type).toBe("SINGLE_CHOICE");
    expect(question.explanation).toBe("Because.");
  });

  test("an option is wrong unless marked correct", async () => {
    const { quiz } = await createQuizWorld();

    const { right, wrong } = await addQuestion(quiz.id);

    expect(right.isCorrect).toBe(true);
    expect(wrong.isCorrect).toBe(false);
  });

  test("two questions cannot share a position in a quiz", async () => {
    const { quiz } = await createQuizWorld();
    await addQuestion(quiz.id, 1);

    await expect(addQuestion(quiz.id, 1)).rejects.toMatchObject({ code: "P2002" });
  });
});

describe("quiz attempts", () => {
  test("a second attempt with the same key for the same enrollment and quiz is rejected", async () => {
    const { enrollment, quiz } = await createQuizWorld();
    const data = {
      enrollmentId: enrollment.id,
      quizId: quiz.id,
      idempotencyKey: "key-1",
      passMarkSnapshot: 70,
    };
    await database.prisma.quizAttempt.create({ data });

    await expect(database.prisma.quizAttempt.create({ data })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  test("the same key is accepted for a different quiz", async () => {
    const world = await createQuizWorld();
    const otherModule = await database.prisma.module.create({
      data: { revisionId: world.module.revisionId, order: 2, title: "Module two" },
    });
    const otherQuiz = await database.prisma.quiz.create({ data: { moduleId: otherModule.id } });
    const base = {
      enrollmentId: world.enrollment.id,
      idempotencyKey: "key-1",
      passMarkSnapshot: 70,
    };
    await database.prisma.quizAttempt.create({ data: { ...base, quizId: world.quiz.id } });

    const attempt = await database.prisma.quizAttempt.create({
      data: { ...base, quizId: otherQuiz.id },
    });

    expect(attempt.quizId).toBe(otherQuiz.id);
  });

  test("changing the quiz pass mark later leaves the attempt snapshot and score unchanged", async () => {
    const { enrollment, quiz } = await createQuizWorld();
    const attempt = await database.prisma.quizAttempt.create({
      data: {
        enrollmentId: enrollment.id,
        quizId: quiz.id,
        idempotencyKey: "key-1",
        passMarkSnapshot: quiz.passMarkPercent,
        scorePercent: 75,
        passed: true,
        submittedAt: new Date(),
      },
    });

    await database.prisma.quiz.update({ where: { id: quiz.id }, data: { passMarkPercent: 90 } });

    const reloaded = await database.prisma.quizAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    });
    expect(reloaded.passMarkSnapshot).toBe(70);
    expect(reloaded.scorePercent).toBe(75);
    expect(reloaded.passed).toBe(true);
  });

  test("an attempt records when it started", async () => {
    const { enrollment, quiz } = await createQuizWorld();

    const attempt = await database.prisma.quizAttempt.create({
      data: {
        enrollmentId: enrollment.id,
        quizId: quiz.id,
        idempotencyKey: "key-1",
        passMarkSnapshot: 70,
      },
    });

    expect(attempt.startedAt).toBeInstanceOf(Date);
    expect(attempt.submittedAt).toBeNull();
    expect(attempt.scorePercent).toBeNull();
  });

  test.each([-1, 101])("score %s is rejected", async (scorePercent) => {
    const { enrollment, quiz } = await createQuizWorld();

    await expect(
      database.prisma.quizAttempt.create({
        data: {
          enrollmentId: enrollment.id,
          quizId: quiz.id,
          idempotencyKey: "key-1",
          passMarkSnapshot: 70,
          scorePercent,
        },
      }),
    ).rejects.toThrow(/QuizAttempt_scorePercent_check/);
  });

  test("a snapshot above 100 is rejected", async () => {
    const { enrollment, quiz } = await createQuizWorld();

    await expect(
      database.prisma.quizAttempt.create({
        data: {
          enrollmentId: enrollment.id,
          quizId: quiz.id,
          idempotencyKey: "key-1",
          passMarkSnapshot: 101,
        },
      }),
    ).rejects.toThrow(/QuizAttempt_passMarkSnapshot_check/);
  });
});

describe("answers", () => {
  const attemptWithQuestion = async () => {
    const world = await createQuizWorld();
    const parts = await addQuestion(world.quiz.id);
    const attempt = await database.prisma.quizAttempt.create({
      data: {
        enrollmentId: world.enrollment.id,
        quizId: world.quiz.id,
        idempotencyKey: "key-1",
        passMarkSnapshot: 70,
      },
    });
    return { ...world, ...parts, attempt };
  };

  test("an attempt holds one answer per question", async () => {
    const { attempt, question, right, wrong } = await attemptWithQuestion();
    await database.prisma.answer.create({
      data: { attemptId: attempt.id, questionId: question.id, optionId: right.id },
    });

    await expect(
      database.prisma.answer.create({
        data: { attemptId: attempt.id, questionId: question.id, optionId: wrong.id },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  test("an attempt with answers cannot be hard deleted", async () => {
    const { attempt, question, right } = await attemptWithQuestion();
    await database.prisma.answer.create({
      data: { attemptId: attempt.id, questionId: question.id, optionId: right.id },
    });

    await expect(
      database.prisma.quizAttempt.delete({ where: { id: attempt.id } }),
    ).rejects.toMatchObject({ code: "P2003" });
  });
});

describe("attempt grants", () => {
  test("a grant names the admin, the quiz and the extra attempts", async () => {
    const { admin, enrollment, quiz } = await createQuizWorld();

    const grant = await database.prisma.attemptGrant.create({
      data: {
        enrollmentId: enrollment.id,
        quizId: quiz.id,
        adminId: admin.id,
        extraAttempts: 2,
        reason: "Network failure",
      },
    });

    expect(grant.grantedAt).toBeInstanceOf(Date);
    expect(grant.extraAttempts).toBe(2);
  });

  test("a grant of no attempts is rejected", async () => {
    const { admin, enrollment, quiz } = await createQuizWorld();

    await expect(
      database.prisma.attemptGrant.create({
        data: { enrollmentId: enrollment.id, quizId: quiz.id, adminId: admin.id, extraAttempts: 0 },
      }),
    ).rejects.toThrow(/AttemptGrant_extraAttempts_check/);
  });
});

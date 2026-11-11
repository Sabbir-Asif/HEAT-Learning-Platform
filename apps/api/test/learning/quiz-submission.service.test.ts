import { NotFoundException } from "@nestjs/common";
import { describe, expect, test, vi } from "vitest";
import { QuizSubmissionService } from "../../src/learning/quiz-submission.service";

const questions = [
  {
    id: "q1",
    options: [
      { id: "q1a", isCorrect: true },
      { id: "q1b", isCorrect: false },
    ],
  },
  {
    id: "q2",
    options: [
      { id: "q2a", isCorrect: false },
      { id: "q2b", isCorrect: true },
    ],
  },
];

const quiz = { id: "z1", attemptLimit: 3, waitMinutes: 10, questions };
const request = {
  attemptId: "a1",
  idempotencyKey: "key-1",
  answers: { q1: "q1a", q2: "q2b" },
};
const openAttempt = {
  id: "a1",
  idempotencyKey: "attempt-1",
  passMarkSnapshot: 70,
  submittedAt: null,
};

interface Options {
  enrollment?: object | null;
  quiz?: object | null;
  attempt?: object | null;
  submitted?: object[];
  grants?: object[];
  gate?: ReturnType<typeof vi.fn>;
  handlers?: { onQuizScored: ReturnType<typeof vi.fn> }[];
  replayAnswers?: object[];
}

const build = (options: Options = {}) => {
  const requireUnlocked = options.gate ?? vi.fn().mockResolvedValue("QUIZ_READY");
  const tx = {
    enrollment: {
      findFirst: vi
        .fn()
        .mockResolvedValue(options.enrollment === undefined ? { id: "e1" } : options.enrollment),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ id: "e1" }]),
    quiz: {
      findFirst: vi.fn().mockResolvedValue(options.quiz === undefined ? quiz : options.quiz),
    },
    quizAttempt: {
      findFirst: vi
        .fn()
        .mockResolvedValue(options.attempt === undefined ? openAttempt : options.attempt),
      findMany: vi.fn().mockResolvedValue(options.submitted ?? []),
      update: vi.fn().mockResolvedValue({}),
    },
    attemptGrant: { findMany: vi.fn().mockResolvedValue(options.grants ?? []) },
    answer: {
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
      findMany: vi.fn().mockResolvedValue(options.replayAnswers ?? []),
    },
  };
  const database = { $transaction: vi.fn((work: (client: unknown) => unknown) => work(tx)) };
  const handlers = options.handlers ?? [];
  const service = new QuizSubmissionService(
    database as never,
    { requireUnlocked } as never,
    handlers as never,
  );
  return { service, tx, database, requireUnlocked, handlers };
};

describe("QuizSubmissionService.submit", () => {
  test("asks the gate first and does not open a transaction when it refuses", async () => {
    const gate = vi.fn().mockRejectedValue({ status: 403, code: "QUIZ_NOT_UNLOCKED" });
    const { service, database } = build({ gate });
    await expect(service.submit("u1", "c1", "m1", request)).rejects.toMatchObject({
      code: "QUIZ_NOT_UNLOCKED",
    });
    expect(gate).toHaveBeenCalledWith("u1", "c1", "m1");
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  test("locks the enrollment row inside the transaction before reading attempts", async () => {
    const { service, tx } = build();
    await service.submit("u1", "c1", "m1", request);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.quizAttempt.findFirst.mock.invocationCallOrder[0] as number,
    );
  });

  test("scores a passing attempt, records answers and closes the attempt", async () => {
    const { service, tx } = build();
    const result = await service.submit("u1", "c1", "m1", request);
    expect(result).toEqual({
      attemptId: "a1",
      scorePercent: 100,
      passed: true,
      passMarkPercent: 70,
      correctCount: 2,
      totalQuestions: 2,
    });
    expect(tx.answer.createMany).toHaveBeenCalledWith({
      data: [
        { attemptId: "a1", questionId: "q1", optionId: "q1a" },
        { attemptId: "a1", questionId: "q2", optionId: "q2b" },
      ],
    });
    expect(tx.quizAttempt.update).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: {
        idempotencyKey: "key-1",
        scorePercent: 100,
        passed: true,
        submittedAt: expect.any(Date),
      },
    });
  });

  test("scores against the pass mark snapshot of the attempt and counts unanswered as wrong", async () => {
    const { service } = build({ attempt: { ...openAttempt, passMarkSnapshot: 60 } });
    const result = await service.submit("u1", "c1", "m1", { ...request, answers: { q1: "q1a" } });
    expect(result).toMatchObject({
      scorePercent: 50,
      passed: false,
      passMarkPercent: 60,
      correctCount: 1,
    });
  });

  test("returns only the aggregate result without per-question correctness", async () => {
    const { service } = build();
    const result = await service.submit("u1", "c1", "m1", request);
    expect(Object.keys(result).sort()).toEqual([
      "attemptId",
      "correctCount",
      "passMarkPercent",
      "passed",
      "scorePercent",
      "totalQuestions",
    ]);
  });

  test("rejects an option from another question with 400 and writes nothing", async () => {
    const { service, tx } = build();
    await expect(
      service.submit("u1", "c1", "m1", { ...request, answers: { q1: "q2a" } }),
    ).rejects.toMatchObject({ status: 400, code: "QUIZ_ANSWER_INVALID" });
    expect(tx.answer.createMany).not.toHaveBeenCalled();
    expect(tx.quizAttempt.update).not.toHaveBeenCalled();
  });

  test("rejects a question outside the quiz with 400", async () => {
    const { service } = build();
    await expect(
      service.submit("u1", "c1", "m1", { ...request, answers: { other: "q1a" } }),
    ).rejects.toMatchObject({ status: 400, code: "QUIZ_ANSWER_INVALID" });
  });

  test("refuses with the next attempt time five minutes into the wait", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-12T10:00:00Z"));
    try {
      const { service, tx } = build({
        submitted: [{ passed: false, submittedAt: new Date("2026-11-12T09:55:00Z") }],
      });
      await expect(service.submit("u1", "c1", "m1", request)).rejects.toMatchObject({
        status: 409,
        code: "QUIZ_ATTEMPT_WAIT",
        retryAfterSeconds: 300,
        details: { nextAttemptAt: "2026-11-12T10:05:00.000Z" },
      });
      expect(tx.answer.createMany).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  test("refuses with the limit reached code when all attempts are used", async () => {
    const submitted = [1, 2, 3].map((hour) => ({
      passed: false,
      submittedAt: new Date(`2026-11-10T0${hour}:00:00Z`),
    }));
    const { service } = build({ submitted });
    await expect(service.submit("u1", "c1", "m1", request)).rejects.toMatchObject({
      status: 409,
      code: "QUIZ_ATTEMPT_LIMIT_REACHED",
    });
  });

  test("granted attempts allow another submission", async () => {
    const submitted = [1, 2, 3].map((hour) => ({
      passed: false,
      submittedAt: new Date(`2026-11-10T0${hour}:00:00Z`),
    }));
    const { service } = build({ submitted, grants: [{ extraAttempts: 1 }, { extraAttempts: 1 }] });
    await expect(service.submit("u1", "c1", "m1", request)).resolves.toMatchObject({
      passed: true,
    });
  });

  test("refuses when the quiz was already passed", async () => {
    const { service } = build({
      submitted: [{ passed: true, submittedAt: new Date("2026-11-11T09:00:00Z") }],
    });
    await expect(service.submit("u1", "c1", "m1", request)).rejects.toMatchObject({
      status: 409,
      code: "QUIZ_ATTEMPT_NOT_OPEN",
    });
  });

  test("replays the stored result for the same key without writing again", async () => {
    const { service, tx, handlers } = build({
      attempt: { ...openAttempt, idempotencyKey: "key-1", submittedAt: new Date() },
      replayAnswers: [
        { questionId: "q1", optionId: "q1a" },
        { questionId: "q2", optionId: "q2a" },
      ],
    });
    const first = await service.submit("u1", "c1", "m1", request);
    expect(first).toEqual({
      attemptId: "a1",
      scorePercent: 50,
      passed: false,
      passMarkPercent: 70,
      correctCount: 1,
      totalQuestions: 2,
    });
    expect(tx.answer.createMany).not.toHaveBeenCalled();
    expect(tx.quizAttempt.update).not.toHaveBeenCalled();
    expect(handlers).toEqual([]);
  });

  test("refuses a submitted attempt under a different key", async () => {
    const { service } = build({
      attempt: { ...openAttempt, idempotencyKey: "other", submittedAt: new Date() },
    });
    await expect(service.submit("u1", "c1", "m1", request)).rejects.toMatchObject({
      status: 409,
      code: "QUIZ_ATTEMPT_NOT_OPEN",
    });
  });

  test("answers 404 for an attempt that is not the student's", async () => {
    const { service } = build({ attempt: null });
    await expect(service.submit("u1", "c1", "m1", request)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  test("answers 404 when the module has no quiz", async () => {
    const { service } = build({ quiz: null });
    await expect(service.submit("u1", "c1", "m1", request)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  test("answers enrollment not active when the enrollment disappeared", async () => {
    const { service } = build({ enrollment: null });
    await expect(service.submit("u1", "c1", "m1", request)).rejects.toMatchObject({
      status: 403,
      code: "ENROLLMENT_NOT_ACTIVE",
    });
  });

  test("hands the scored result and the open transaction to every scored handler", async () => {
    const handler = { onQuizScored: vi.fn().mockResolvedValue(undefined) };
    const { service, tx } = build({ handlers: [handler] });
    await service.submit("u1", "c1", "m1", request);
    expect(handler.onQuizScored).toHaveBeenCalledWith({
      tx,
      userId: "u1",
      courseId: "c1",
      moduleId: "m1",
      enrollmentId: "e1",
      quizId: "z1",
      result: {
        attemptId: "a1",
        passMarkPercent: 70,
        correctCount: 2,
        totalQuestions: 2,
        scorePercent: 100,
        passed: true,
      },
    });
    expect(handler.onQuizScored.mock.invocationCallOrder[0]).toBeGreaterThan(
      tx.quizAttempt.update.mock.invocationCallOrder[0] as number,
    );
  });

  test("a failing handler fails the submission so the transaction rolls back", async () => {
    const handler = { onQuizScored: vi.fn().mockRejectedValue(new Error("boom")) };
    const { service } = build({ handlers: [handler] });
    await expect(service.submit("u1", "c1", "m1", request)).rejects.toThrow("boom");
  });
});

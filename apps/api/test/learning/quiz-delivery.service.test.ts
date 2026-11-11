import { NotFoundException } from "@nestjs/common";
import { describe, expect, test, vi } from "vitest";
import { QuizDeliveryService } from "../../src/learning/quiz-delivery.service";

const quizRow = {
  id: "z1",
  passMarkPercent: 70,
  attemptLimit: 2,
  waitMinutes: 10,
  questions: [
    {
      id: "q1",
      order: 1,
      text: "One",
      options: [
        { id: "o1", text: "A" },
        { id: "o2", text: "B" },
        { id: "o3", text: "C" },
      ],
    },
  ],
};

interface Options {
  quiz?: object | null;
  attempts?: object[];
  grants?: object[];
  gate?: ReturnType<typeof vi.fn>;
  create?: ReturnType<typeof vi.fn>;
  inProgress?: object | null;
}

const build = (options: Options = {}) => {
  const requireUnlocked = options.gate ?? vi.fn().mockResolvedValue("QUIZ_READY");
  const create =
    options.create ??
    vi.fn().mockResolvedValue({ id: "a-new", startedAt: new Date("2026-11-12T04:00:00Z") });
  const findFirst = vi.fn().mockResolvedValue(options.inProgress ?? null);
  const database = {
    enrollment: { findFirst: vi.fn().mockResolvedValue({ id: "e1" }) },
    quiz: {
      findFirst: vi.fn().mockResolvedValue(options.quiz === undefined ? quizRow : options.quiz),
    },
    quizAttempt: {
      findMany: vi.fn().mockResolvedValue(options.attempts ?? []),
      findFirst,
      create,
    },
    attemptGrant: { findMany: vi.fn().mockResolvedValue(options.grants ?? []) },
  };
  const service = new QuizDeliveryService(database as never, { requireUnlocked } as never);
  return { service, database, requireUnlocked, create, findFirst };
};

const none = {
  attemptsUsed: 0,
  attemptsAllowed: 2,
  quiz: null,
  attempt: null,
  questions: [],
  nextAttemptAt: null,
  bestResult: null,
};

const submittedAttempt = (id: string, submittedAt: string, passed = false, scorePercent = 50) => ({
  id,
  scorePercent,
  passed,
  startedAt: new Date(submittedAt),
  submittedAt: new Date(submittedAt),
});

describe("QuizDeliveryService.get", () => {
  test("asks the gate first and surfaces its refusal without touching quiz data", async () => {
    const gate = vi.fn().mockRejectedValue({ status: 403, code: "QUIZ_NOT_UNLOCKED" });
    const { service, database } = build({ gate });
    await expect(service.get("u1", "c1", "m1")).rejects.toMatchObject({
      code: "QUIZ_NOT_UNLOCKED",
    });
    expect(database.quiz.findFirst).not.toHaveBeenCalled();
    expect(database.quizAttempt.create).not.toHaveBeenCalled();
  });

  test("never selects correct flags or explanations from the database", async () => {
    const { service, database } = build();
    await service.get("u1", "c1", "m1");
    const select = JSON.stringify(database.quiz.findFirst.mock.calls[0]?.[0]);
    expect(select).not.toContain("isCorrect");
    expect(select).not.toContain("explanation");
  });

  test("creates a first attempt and delivers shuffled options with exactly the delivery keys", async () => {
    const { service, create } = build();
    const result = await service.get("u1", "c1", "m1");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          enrollmentId: "e1",
          quizId: "z1",
          idempotencyKey: "attempt-1",
          passMarkSnapshot: 70,
        },
      }),
    );
    if (result.status !== "AVAILABLE") throw new Error("expected AVAILABLE");
    expect(Object.keys(result).sort()).toEqual([
      "attempt",
      "attemptsAllowed",
      "attemptsUsed",
      "bestResult",
      "nextAttemptAt",
      "questions",
      "quiz",
      "status",
    ]);
    expect(Object.keys(result.questions[0] ?? {}).sort()).toEqual([
      "id",
      "options",
      "order",
      "text",
    ]);
    expect(result.questions[0]?.options.map((option) => Object.keys(option).sort())).toEqual([
      ["id", "text"],
      ["id", "text"],
      ["id", "text"],
    ]);
    expect(JSON.stringify(result)).not.toMatch(/correct|explanation/i);
    expect(result.attemptsAllowed).toBe(2);
  });

  test("reuses the in-progress attempt and returns the same option order on reload", async () => {
    const inProgress = { id: "a-open", startedAt: new Date("2026-11-12T03:00:00Z") };
    const { service, create } = build({ inProgress });
    const first = await service.get("u1", "c1", "m1");
    const second = await service.get("u1", "c1", "m1");
    expect(create).not.toHaveBeenCalled();
    expect(second).toEqual(first);
  });

  test("a later attempt number gets its own idempotency key and a different attempt id seed", async () => {
    const past = new Date(Date.now() - 3_600_000).toISOString();
    const { service, create } = build({ attempts: [submittedAttempt("a1", past)] });
    await service.get("u1", "c1", "m1");
    expect(create.mock.calls[0]?.[0].data.idempotencyKey).toBe("attempt-2");
  });

  test("returns the next attempt time while the wait has not passed", async () => {
    const recent = new Date(Date.now() - 60_000);
    const { service, create } = build({ attempts: [submittedAttempt("a1", recent.toISOString())] });
    const result = await service.get("u1", "c1", "m1");
    expect(result).toEqual({
      ...none,
      status: "WAITING",
      attemptsUsed: 1,
      attemptsAllowed: 2,
      nextAttemptAt: new Date(recent.getTime() + 600_000).toISOString(),
    });
    expect(create).not.toHaveBeenCalled();
  });

  test("returns the exhausted state with no questions once the limit is used", async () => {
    const past = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
    const { service, create } = build({
      attempts: [submittedAttempt("a1", past(5)), submittedAttempt("a2", past(4))],
    });
    const result = await service.get("u1", "c1", "m1");
    expect(result).toEqual({
      ...none,
      status: "EXHAUSTED",
      attemptsUsed: 2,
      attemptsAllowed: 2,
    });
    expect(create).not.toHaveBeenCalled();
  });

  test("extra attempts from a grant lift the limit", async () => {
    const past = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
    const { service } = build({
      attempts: [submittedAttempt("a1", past(5)), submittedAttempt("a2", past(4))],
      grants: [{ extraAttempts: 1 }],
    });
    const result = await service.get("u1", "c1", "m1");
    expect(result.status).toBe("AVAILABLE");
  });

  test("a completed module returns the best past result and no questions", async () => {
    const gate = vi.fn().mockResolvedValue("COMPLETED");
    const { service, create } = build({
      gate,
      attempts: [
        submittedAttempt("a1", "2026-11-12T01:00:00Z", false, 40),
        submittedAttempt("a2", "2026-11-12T02:00:00Z", true, 90),
      ],
    });
    const result = await service.get("u1", "c1", "m1");
    expect(result).toEqual({
      ...none,
      status: "PASSED",
      attemptsUsed: 2,
      attemptsAllowed: 2,
      quiz: { id: "z1", passMarkPercent: 70 },
      bestResult: {
        attemptId: "a2",
        scorePercent: 90,
        passed: true,
        submittedAt: "2026-11-12T02:00:00.000Z",
      },
    });
    expect(create).not.toHaveBeenCalled();
  });

  test("a completed module without scored attempts returns a null best result", async () => {
    const gate = vi.fn().mockResolvedValue("COMPLETED");
    const { service } = build({ gate });
    const result = await service.get("u1", "c1", "m1");
    expect(result).toMatchObject({ status: "PASSED", bestResult: null });
  });

  test("is not found when the module has no quiz or no questions", async () => {
    await expect(build({ quiz: null }).service.get("u1", "c1", "m1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      build({ quiz: { ...quizRow, questions: [] } }).service.get("u1", "c1", "m1"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  test("falls back to the existing attempt when two requests race on creation", async () => {
    const create = vi.fn().mockRejectedValue({ code: "P2002" });
    const { service, findFirst } = build({ create });
    findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "a-raced", startedAt: new Date("2026-11-12T03:00:00Z") });
    const result = await service.get("u1", "c1", "m1");
    expect(result).toMatchObject({ status: "AVAILABLE", attempt: { id: "a-raced" } });
  });

  test("rethrows other creation errors", async () => {
    const create = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(build({ create }).service.get("u1", "c1", "m1")).rejects.toThrow("boom");
  });
});

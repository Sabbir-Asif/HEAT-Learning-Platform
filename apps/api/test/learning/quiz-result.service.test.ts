import { NotFoundException } from "@nestjs/common";
import { describe, expect, test, vi } from "vitest";
import { QuizResultService } from "../../src/learning/quiz-result.service";

const submittedAt = new Date("2026-11-12T10:00:00.000Z");

const questions = [
  {
    id: "q1",
    order: 1,
    text: "First",
    explanation: "Because",
    options: [
      { id: "q1a", text: "A", isCorrect: true },
      { id: "q1b", text: "B", isCorrect: false },
    ],
  },
];

const build = (
  attempt: object | null,
  answers: object[] = [{ questionId: "q1", optionId: "q1a" }],
) => {
  const database = {
    enrollment: { findFirst: vi.fn().mockResolvedValue({ id: "e1" }) },
    quiz: { findFirst: vi.fn().mockResolvedValue({ id: "z1", questions }) },
    quizAttempt: { findFirst: vi.fn().mockResolvedValue(attempt) },
    answer: { findMany: vi.fn().mockResolvedValue(answers) },
  };
  const requireUnlocked = vi.fn().mockResolvedValue("QUIZ_READY");
  const service = new QuizResultService(database as never, { requireUnlocked } as never);
  return { service, database, requireUnlocked };
};

const attempt = (passed: boolean | null, score: number | null) => ({
  id: "a1",
  scorePercent: score,
  passed,
  passMarkSnapshot: 70,
  submittedAt,
});

describe("QuizResultService", () => {
  test("includes the review for a passed attempt", async () => {
    const { service } = build(attempt(true, 100));
    const result = await service.get("u1", "c1", "m1", "a1");
    expect(result).toMatchObject({
      attemptId: "a1",
      scorePercent: 100,
      passed: true,
      passMarkPercent: 70,
      correctCount: 1,
      totalQuestions: 1,
      submittedAt: submittedAt.toISOString(),
    });
    expect(result.review).toHaveLength(1);
  });

  test("returns no review, answers or explanations for a failed attempt", async () => {
    const { service } = build(attempt(false, 0), [{ questionId: "q1", optionId: "q1b" }]);
    const result = await service.get("u1", "c1", "m1", "a1");
    expect(result.passed).toBe(false);
    expect(result.review).toBeNull();
    expect(JSON.stringify(result)).not.toContain("q1a");
    expect(JSON.stringify(result)).not.toContain("Because");
    expect(result.correctCount).toBe(0);
  });

  test("scopes the attempt to the caller's enrollment", async () => {
    const { service, database } = build(attempt(true, 100));
    await service.get("u1", "c1", "m1", "a1");
    expect(database.quizAttempt.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "a1",
          enrollmentId: "e1",
          quizId: "z1",
          submittedAt: { not: null },
        }),
      }),
    );
  });

  test("is not found for an attempt that is not the caller's or not submitted", async () => {
    const { service } = build(null);
    await expect(service.get("u1", "c1", "m1", "other")).rejects.toBeInstanceOf(NotFoundException);
  });

  test("requires the module quiz to be unlocked", async () => {
    const { service, requireUnlocked } = build(attempt(true, 100));
    await service.get("u1", "c1", "m1", "a1");
    expect(requireUnlocked).toHaveBeenCalledWith("u1", "c1", "m1");
  });
});

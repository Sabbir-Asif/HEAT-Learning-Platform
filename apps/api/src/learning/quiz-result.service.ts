import type { QuizResultResponse } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DATABASE } from "../core";
import { QuizGateService } from "./quiz-gate";
import { resultReviewOf } from "./quiz-result-rules";
import { correctCountOf } from "./quiz-submission-rules";

@Injectable()
export class QuizResultService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly gate: QuizGateService,
  ) {}

  async get(
    userId: string,
    courseId: string,
    moduleId: string,
    attemptId: string,
  ): Promise<QuizResultResponse> {
    await this.gate.requireUnlocked(userId, courseId, moduleId);
    const enrollment = await this.database.enrollment.findFirst({
      where: { userId, courseId, deletedAt: null },
      select: { id: true },
    });
    const quiz = await this.database.quiz.findFirst({
      where: { moduleId, deletedAt: null },
      select: {
        id: true,
        questions: {
          where: { deletedAt: null },
          orderBy: { order: "asc" },
          select: {
            id: true,
            order: true,
            text: true,
            explanation: true,
            options: {
              orderBy: { order: "asc" },
              select: { id: true, text: true, isCorrect: true },
            },
          },
        },
      },
    });
    if (enrollment === null || quiz === null) throw new NotFoundException();
    const attempt = await this.database.quizAttempt.findFirst({
      where: {
        id: attemptId,
        enrollmentId: enrollment.id,
        quizId: quiz.id,
        submittedAt: { not: null },
      },
      select: {
        id: true,
        scorePercent: true,
        passed: true,
        passMarkSnapshot: true,
        submittedAt: true,
      },
    });
    if (attempt === null || attempt.submittedAt === null) throw new NotFoundException();
    const rows = await this.database.answer.findMany({
      where: { attemptId: attempt.id },
      select: { questionId: true, optionId: true },
    });
    const answers = Object.fromEntries(rows.map((row) => [row.questionId, row.optionId]));
    return {
      attemptId: attempt.id,
      scorePercent: attempt.scorePercent ?? 0,
      passed: attempt.passed === true,
      passMarkPercent: attempt.passMarkSnapshot,
      correctCount: correctCountOf(quiz.questions, answers),
      totalQuestions: quiz.questions.length,
      submittedAt: attempt.submittedAt.toISOString(),
      review: resultReviewOf(attempt.passed, quiz.questions, answers),
    };
  }
}

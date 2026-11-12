import type { QuizDeliveryResponse } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DATABASE } from "../core";
import { quizStateOf } from "./learning-rules";
import {
  attemptIdempotencyKey,
  bestResultOf,
  deliverQuestions,
  isUniqueViolation,
} from "./quiz-delivery-rules";
import { QuizGateService } from "./quiz-gate";

@Injectable()
export class QuizDeliveryService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly gate: QuizGateService,
  ) {}

  async get(userId: string, courseId: string, moduleId: string): Promise<QuizDeliveryResponse> {
    const moduleState = await this.gate.requireUnlocked(userId, courseId, moduleId);
    const enrollment = await this.database.enrollment.findFirst({
      where: { userId, courseId, deletedAt: null },
      select: { id: true },
    });
    const quiz = await this.database.quiz.findFirst({
      where: { moduleId, deletedAt: null },
      select: {
        id: true,
        passMarkPercent: true,
        attemptLimit: true,
        waitMinutes: true,
        questions: {
          where: { deletedAt: null },
          orderBy: { order: "asc" },
          select: {
            id: true,
            order: true,
            text: true,
            options: { orderBy: { order: "asc" }, select: { id: true, text: true } },
          },
        },
      },
    });
    if (enrollment === null || quiz === null || quiz.questions.length === 0) {
      throw new NotFoundException();
    }
    const [attempts, grants] = await Promise.all([
      this.database.quizAttempt.findMany({
        where: { enrollmentId: enrollment.id, quizId: quiz.id },
        orderBy: { startedAt: "asc" },
        select: {
          id: true,
          scorePercent: true,
          passed: true,
          startedAt: true,
          submittedAt: true,
        },
      }),
      this.database.attemptGrant.findMany({
        where: { enrollmentId: enrollment.id, quizId: quiz.id },
        select: { extraAttempts: true },
      }),
    ]);
    const submitted = attempts.flatMap((attempt) =>
      attempt.submittedAt === null
        ? []
        : [{ passed: attempt.passed, submittedAt: attempt.submittedAt }],
    );
    const state = quizStateOf(
      moduleState,
      {
        attemptLimit: quiz.attemptLimit,
        waitMinutes: quiz.waitMinutes,
        extraAttempts: grants.reduce((sum, grant) => sum + grant.extraAttempts, 0),
        attempts: submitted,
      },
      new Date(),
    );
    const empty = {
      attemptsUsed: state.attemptsUsed,
      attemptsAllowed: state.attemptsAllowed,
      quiz: null,
      attempt: null,
      questions: [],
      nextAttemptAt: null,
      bestResult: null,
    };
    if (state.availability === "PASSED") {
      return {
        ...empty,
        status: "PASSED",
        quiz: { id: quiz.id, passMarkPercent: quiz.passMarkPercent },
        bestResult: bestResultOf(attempts),
      };
    }
    if (state.availability === "EXHAUSTED") return { ...empty, status: "EXHAUSTED" };
    if (state.availability === "WAITING" && state.nextAttemptAt !== null) {
      return { ...empty, status: "WAITING", nextAttemptAt: state.nextAttemptAt };
    }
    if (state.availability !== "AVAILABLE") throw new NotFoundException();
    const attempt = await this.openAttempt(
      enrollment.id,
      quiz.id,
      quiz.passMarkPercent,
      state.attemptsUsed,
    );
    return {
      ...empty,
      status: "AVAILABLE",
      quiz: { id: quiz.id, passMarkPercent: quiz.passMarkPercent },
      attempt: { id: attempt.id, startedAt: attempt.startedAt.toISOString() },
      questions: deliverQuestions(attempt.id, quiz.questions),
    };
  }

  private async openAttempt(
    enrollmentId: string,
    quizId: string,
    passMarkPercent: number,
    attemptsUsed: number,
  ): Promise<{ id: string; startedAt: Date }> {
    const find = () =>
      this.database.quizAttempt.findFirst({
        where: { enrollmentId, quizId, submittedAt: null },
        orderBy: { startedAt: "desc" },
        select: { id: true, startedAt: true },
      });
    const existing = await find();
    if (existing !== null) return existing;
    try {
      return await this.database.quizAttempt.create({
        data: {
          enrollmentId,
          quizId,
          idempotencyKey: attemptIdempotencyKey(attemptsUsed),
          passMarkSnapshot: passMarkPercent,
        },
        select: { id: true, startedAt: true },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await find();
        if (raced !== null) return raced;
      }
      throw error;
    }
  }
}
